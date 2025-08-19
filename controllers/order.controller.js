const fs = require('fs');
const Order = require('../models/order.model.js');
const path = require('path');

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
function pickPriceForSample(sample, toLanguage, tariff) {
    if (!sample || !Array.isArray(sample.languageTariffs)) return null;
    const toCode = toIso(toLanguage);
    const key = (tariff || 'normal').toLowerCase(); // normal/express/fast
    const candidates = [ groupOf(toCode), toCode ];  // спершу група, потім чистий код

    const found = sample.languageTariffs.find(t => {
        const lang = norm(t.language || '');
        return candidates.some(c => norm(c) === lang);
    });
    if (!found) return null;

    const val = Number(found[key]);
    return Number.isFinite(val) ? val : null;
}

exports.saveOrder = async (req, res) => {
    try {
        const {
            orderReference,
            selectedSamples,
            fromLanguage,
            toLanguage,
            tariff,
            localLanguagePair,
            totalPriceNormal,
            totalPriceExpress,
            totalPriceFast,
            selectedDate,
        } = req.body;

        if (!orderReference) {
            return res.status(400).json({ error: 'Missing orderReference' });
        }

        const samplesArr = (() => {
            if (!selectedSamples) return [];
            try { return Array.isArray(selectedSamples) ? selectedSamples : JSON.parse(selectedSamples); }
            catch { return []; }
        })();

        // перерахунок ціни КОЖНОГО образца під вибрану пару/тариф
        const samplesWithPrice = samplesArr.map(s => ({
            ...s,
            computedPrice: pickPriceForSample(s, toLanguage, tariff) ?? 0,
        }));

        // файли поклав multer
        const uploadedFiles = (req.files || []).map(f => ({
            name: path.basename(f.filename),
            type: f.mimetype,
            size: f.size,
        }));

        const order = new Order({
            orderReference,
            selectedSamples: samplesWithPrice,
            fromLanguage,
            toLanguage,
            tariff,
            localLanguagePair,
            totalPriceNormal,
            totalPriceExpress,
            totalPriceFast,
            selectedDate,
            uploadedFiles,
        });

        await order.save();
        res.json({ success: true, orderReference });
    } catch (err) {
        console.error('Order save error:', err);
        res.status(500).json({ error: err.message });
    }
};
