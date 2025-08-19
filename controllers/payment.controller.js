const crypto = require('crypto');
const axios = require('axios');
const Order = require('../models/order.model.js');
const sendEmail = require('../utils/sendEmail');
const fs = require('fs');
const path = require('path');
const util = require('util');
const unlinkAsync = util.promisify(fs.unlink);

const WAYFORPAY_SECRET_KEY = process.env.WAYFORPAY_SECRET_KEY;
const merchantAccount = process.env.NEXT_PUBLIC_WAYFORPAY_MERCHANT_ACCOUNT;

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


        if (!order_ref) {
            const newestOrder = await Order.findOne().sort({ createdAt: -1 });
            if (!newestOrder) return res.status(404).json({ error: 'No orders found' });

            await sendOrderEmail(newestOrder);
            return res.status(200).json({ success: true, message: 'Sent newest order to email' });
        }

        let order = await Order.findOne({ orderReference: order_ref });
        if (!order) {
            order = await Order.findOne().sort({ createdAt: -1 });
            if (!order) return res.status(404).json({ error: 'No orders found' });

            await sendOrderEmail(order);
            return res.status(200).json({ success: true, message: 'Sent newest order to email' });
        }

        await sendOrderEmail(order);

        const signature = generateStatusSignature(merchantAccount, order_ref);
        const response = await axios.post('https://api.wayforpay.com/api', {
            apiVersion: 1,
            transactionType: 'CHECK_STATUS',
            merchantAccount,
            orderReference: order_ref,
            merchantSignature: signature
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        return res.json(response.data);
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
    let html = `<h2>Новая заявка на перевод</h2>
<p><b>Языковая пара:</b> ${order.localLanguagePair || `${order.fromLanguage} - ${order.toLanguage}`}</p>
<p><b>Тариф:</b> ${order.tariff || "-"}</p>
<p><b>Общая стоимость:</b> ${order.totalPriceNormal || order.totalPriceExpress || order.totalPriceFast || "-"} ₸</p>`;
    if (order.selectedDate) html += `<p><b>Выбранная дата:</b> ${order.selectedDate}</p>`;
    html += `<hr/>`;

    for (const s of samples) {
        const fallbackPrice = pickPriceForSample(s, order.toLanguage, order.tariff);
        const priceToShow = (s.computedPrice ?? fallbackPrice);
        html += `
<h3>${s.docName || "Документ"}</h3>
<b>Документ</b>: ${s.sampleTitle || "-"}<br/>
<b>Языковая пара</b>: ${order.localLanguagePair || "-"}<br/>
<b>Тариф</b>: ${order.tariff || "-"}<br/>
<b>Стоимость</b>: ${priceToShow != null ? priceToShow : "-"}₸<br/>
<b>ФИО латиницей</b>: ${s.fioLatin || "-"}<br/>
<b>Печать</b>: ${s.sealText || "-"}<br/>
<b>Штамп</b>: ${s.stampText || "-"}<br/>
<hr/>`;
    }

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
        "Новая заявка на перевод",
        "",
        attachments.length ? attachments : undefined,
        html
    );

    for (const file of order.uploadedFiles || []) {
        const filePath = path.join(__dirname, '../files', file.name);
        if (fs.existsSync(filePath)) {
            await unlinkAsync(filePath);
        }
    }
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
