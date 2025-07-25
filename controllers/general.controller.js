import General from '../models/general.model.js';
import crypto from 'crypto';

const getGeneral = async (req, res) => {
    let general = await General.findOne();
    if (!general) {
        general = new General();
        await general.save();
    }
    res.set('Cache-Control', 'no-store');
    res.json(general);
};

const updateGeneral = async (req, res) => {
    let general = await General.findOne();
    if (!general) {
        general = new General();
    }
    Object.assign(general, req.body);
    await general.save();

    res.set('Cache-Control', 'no-store');
    res.json(general);
};


const initWayforpayPayment = async (req, res) => {
    const {
        email,
        totalValue,
        productName = 'Document translation',
        orderReference = 'ORD-' + Date.now(),
        currency = 'KZT'
    } = req.body;

    const merchantAccount = 'www_dokee_pro';
    // ВАЖНО: Убедитесь, что этот секретный ключ ТОЧНО соответствует ключу,
    const merchantSecretKey = '43f8ec5981329304f612662659733c518739b69c';
    const merchantDomainName = 'www.dokee.pro';
    const amount = parseFloat(totalValue).toFixed(2);
    const orderDate = Math.floor(Date.now() / 1000);

    const productCount = '1';
    const productPrice = amount;

    const signatureSource = [
        merchantAccount,
        merchantDomainName,
        orderReference,
        orderDate,
        amount,
        currency, // Используем валюту, полученную из запроса
        productName,
        productCount,
        productPrice
    ].join(';');

    const merchantSignature = crypto
        .createHash('md5')
        .update(signatureSource + merchantSecretKey)
        .digest('hex');

    res.json({
        merchantAccount,
        merchantDomainName,
        orderReference,
        orderDate,
        amount,
        currency,
        productName: [productName],
        productCount: [productCount],
        productPrice: [productPrice],
        clientEmail: email,
        merchantSignature
    });
};



export { getGeneral, updateGeneral, initWayforpayPayment };