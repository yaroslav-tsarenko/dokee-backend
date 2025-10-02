const crypto = require('crypto');
const axios = require('axios');
const Order = require('../models/order.model.js');
const sendEmail = require('../utils/sendEmail');
const fs = require('fs');
const path = require('path');
const util = require('util');
const unlinkAsync = util.promisify(fs.unlink);
const FormData = require('form-data');

const WAYFORPAY_SECRET_KEY = process.env.WAYFORPAY_SECRET_KEY;
const merchantAccount = process.env.NEXT_PUBLIC_WAYFORPAY_MERCHANT_ACCOUNT;
const TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_CHANNEL_ID = process.env.CHANNEL_ID;

// controllers/payment.controller.js

async function sendOrderToTelegram(order) {
    const samples = order.selectedSamples || [];
    const files = order.uploadedFiles || [];

    // рахуємо суму
    let totalPrice = 0;

    let message = `<b>Нова заявка на переклад</b>\n\n`;
    message += `<b>Замовлення №:</b> ${order.orderReference || "-"}\n`;
    message += `<b>Мовна пара:</b> ${order.localLanguagePair || `${order.fromLanguage} → ${order.toLanguage}`}\n`;
    message += `<b>Тариф:</b> ${order.tariff || "-"}\n`;

    message += `\n<b>Документи:</b>\n`;

    for (const s of samples) {
        const fallbackPrice = pickPriceForSample(s, order.toLanguage, order.tariff);
        const priceToShow = (s.computedPrice ?? fallbackPrice);
        if (priceToShow) totalPrice += priceToShow;

        message += `\n📄 <b>${s.docName || "Документ"}</b>\n`;
        message += `Назва: ${s.sampleTitle || "-"}\n`;
        message += `Мовна пара: ${order.localLanguagePair || "-"}\n`;
        message += `Тариф: ${order.tariff || "-"}\n`;
        message += `Вартість: ${priceToShow != null ? priceToShow : "-"} ₸\n`;
        message += `ФІО латиницею: ${s.fioLatin || "-"}\n`;
        message += `Печатка: ${s.sealText || "-"}\n`;
        message += `Штамп: ${s.stampText || "-"}\n`;
    }

    // виводимо після документів правильну загальну суму
    message = message.replace(
        `<b>Тариф:</b> ${order.tariff || "-"}`,
        `<b>Тариф:</b> ${order.tariff || "-"}\n<b>Загальна вартість:</b> ${totalPrice} ₸`
    );

    if (order.selectedDate) {
        message += `\n\n<b>Обрана дата:</b> ${order.selectedDate}\n`;
    }

    // --- Основне повідомлення
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHANNEL_ID,
            text: message.trim(),
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
        console.log('✅ Telegram message sent');
    } catch (err) {
        console.error('❌ Telegram message error:', err?.response?.data || err.message);
    }

    // --- Відправка файлів
    for (const file of files) {
        const filePath = path.join(__dirname, '../files', file.name);
        try {
            if (fs.existsSync(filePath)) {
                const form = new FormData();
                form.append('chat_id', TELEGRAM_CHANNEL_ID);
                form.append('caption', `📎 ${file.name}`);
                form.append('document', fs.createReadStream(filePath));

                await axios.post(
                    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`,
                    form,
                    { headers: form.getHeaders() }
                );
                console.log('📤 Telegram local file sent:', file.name);

                await unlinkAsync(filePath); // 🗑 видаляємо після відправки
            } else if (file.cdnUrl) {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
                    chat_id: TELEGRAM_CHANNEL_ID,
                    document: file.cdnUrl,
                    caption: `📎 ${file.name}`
                });
                console.log('📤 Telegram CDN file sent:', file.cdnUrl);
            } else {
                console.warn('⚠️ File not found for Telegram:', file.name);
            }
        } catch (err) {
            console.error('❌ Telegram document error:', file.name, err?.response?.data || err.message);
        }
    }
}






function generateStatusSignature(merchantAccount, orderReference) {
    const signatureString = `${merchantAccount};${orderReference}`;
    return crypto
        .createHmac('md5', WAYFORPAY_SECRET_KEY)
        .update(signatureString)
        .digest('hex');
}

// ── додай мапу назв → ISO-коди
const toLangMap = {
    'русский':'ru','английский':'en','украинский':'uk','немецкий':'de','польский':'pl',
    'французский':'fr','итальянский':'it','испанский':'es','литовский':'lt','португальский':'pt',
    'чешский':'cz','словацкий':'sk','эстонский':'et','латышский':'lv','греческий':'el','японский':'ja',
    'китайский':'zh','корейский':'ko','турецкий':'tr','казахский':'kk','узбекский':'uz',
    'румынский':'ro','болгарский':'bg','венгерский':'hu','словенский':'sl','финский':'fi','шведский':'sv',
    'датский':'da','норвежский':'no','нидерландский':'nl','армянский':'hy','грузинский':'ka','азербайджанский':'az',
    // можливі варіанти
    'cz':'cz','cs':'cs','ua':'uk'
};

function norm(s='') {
    return String(s).trim().toLowerCase().replace(/[\s,_-]+/g,'');
}
function toIso(raw='') {
    const n = norm(raw);
    // якщо це вже код (en, de, uk, …) — повертаємо як є
    if (/^[a-z]{2,3}$/.test(n)) {
        if (n === 'ua') return 'uk';
        return n;
    }
    // якщо це назва (английский) — мапимо
    return toLangMap[n] || n;
}
function groupOf(code='') {
    // групи в твоїх тарифах
    if (['fr','it','es'].includes(code)) return 'fr_it_es';
    if (['pl','cz','cs'].includes(code)) return 'pl_cz';
    if (['lt','pt'].includes(code))      return 'lt_pt';
    return code;
}

exports.checkWayforpayStatus = async (req, res) => {
    try {
        const { order_ref } = req.body;

        let order;
        if (!order_ref) {
            order = await Order.findOne().sort({ createdAt: -1 });
        } else {
            order = await Order.findOne({ orderReference: order_ref });
            if (!order) {
                order = await Order.findOne().sort({ createdAt: -1 });
            }
        }

        if (!order) return res.status(404).json({ error: 'No orders found' });

        // 🚀 Відправка email + Telegram
        await sendOrderEmail(order);
        await sendOrderToTelegram(order);

        // Далі перевірка статусу в WayForPay
        if (order_ref) {
            const signature = generateStatusSignature(merchantAccount, order_ref);
            const response = await axios.post('https://api.wayforpay.com/api', {
                apiVersion: 1,
                transactionType: 'CHECK_STATUS',
                merchantAccount,
                orderReference: order_ref,
                merchantSignature: signature
            }, { headers: { 'Content-Type': 'application/json' } });

            return res.json(response.data);
        }

        return res.status(200).json({ success: true, message: 'Order sent to email + Telegram' });
    } catch (error) {
        console.error('WayForPay status check error:', error?.response?.data || error.message);
        return res.status(500).json({ error: 'Failed to check payment status' });
    }
};


function pickPriceForSample(sample, toLanguage, tariff) {
    if (!sample || !Array.isArray(sample.languageTariffs)) return null;
    const toCode = toIso(toLanguage);
    const key = (tariff || 'normal').toLowerCase();
    const candidates = [ groupOf(toCode), toCode ];
    const found = sample.languageTariffs.find(t => norm(t.language||'') === norm(candidates[0]) || norm(t.language||'') === norm(candidates[1]));
    if (!found) return null;
    const val = Number(found[key]);
    return Number.isFinite(val) ? val : null;
}

async function sendOrderEmail(order) {
    const samples = order.selectedSamples || [];
    let totalPrice = 0;

    let html = `<h2>Нова заявка на переклад</h2>
<p><b>Мовна пара:</b> ${order.localLanguagePair || `${order.fromLanguage} → ${order.toLanguage}`}</p>
<p><b>Тариф:</b> ${order.tariff || "-"}</p>`;

    if (order.selectedDate) html += `<p><b>Обрана дата:</b> ${order.selectedDate}</p>`;
    html += `<hr/>`;

    for (const s of samples) {
        const fallbackPrice = pickPriceForSample(s, order.toLanguage, order.tariff);
        const priceToShow = (s.computedPrice ?? fallbackPrice);
        if (priceToShow) totalPrice += priceToShow;

        html += `
<h3>${s.docName || "Документ"}</h3>
<b>Документ:</b> ${s.sampleTitle || "-"}<br/>
<b>Мовна пара:</b> ${order.localLanguagePair || "-"}<br/>
<b>Тариф:</b> ${order.tariff || "-"}<br/>
<b>Вартість:</b> ${priceToShow != null ? priceToShow : "-"} ₸<br/>
<b>ФІО латиницею:</b> ${s.fioLatin || "-"}<br/>
<b>Печатка:</b> ${s.sealText || "-"}<br/>
<b>Штамп:</b> ${s.stampText || "-"}<br/>
<hr/>`;
    }

    // виводимо правильну суму
    html = `<p><b>Загальна вартість:</b> ${totalPrice} ₸</p>` + html;

    const attachments = [];
    for (const file of order.uploadedFiles || []) {
        const filePath = path.join(__dirname, '../files', file.name);
        if (fs.existsSync(filePath)) {
            attachments.push({
                filename: file.name,
                content: fs.readFileSync(filePath)
            });
        }
    }

    await sendEmail(
        "dokee.pro@gmail.com",
        "Нова заявка на переклад",
        "",
        attachments.length ? attachments : undefined,
        html
    );
}




// Існуюча функція генерації підпису для оплати
function generateSignature(fields) {
    const signatureFields = [
        'merchantAccount',
        'merchantDomainName',
        'orderReference',
        'orderDate',
        'amount',
        'currency',
        'productName',
        'productCount',
        'productPrice'
    ];

    const values = signatureFields.map((key) => {
        const value = fields[key];
        if (Array.isArray(value)) {
            return value.join(';');
        }
        return value;
    });

    const signatureString = values.join(';');
    return crypto.createHmac('md5', WAYFORPAY_SECRET_KEY)
        .update(signatureString)
        .digest('hex');
}

exports.generateWayforpaySignature = (req, res) => {
    try {
        const {
            merchantAccount,
            merchantDomainName,
            orderReference,
            orderDate,
            amount,
            currency,
            productName,
            productCount,
            productPrice
        } = req.body;

        if (
            !merchantAccount || !merchantDomainName || !orderReference ||
            !orderDate || !amount || !currency ||
            !productName || !productCount || !productPrice
        ) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const signature = generateSignature({
            merchantAccount,
            merchantDomainName,
            orderReference,
            orderDate,
            amount,
            currency,
            productName,
            productCount,
            productPrice
        });

        return res.json({ signature });
    } catch (err) {
        console.error('Signature generation error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
