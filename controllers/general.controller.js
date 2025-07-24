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
        orderReference = 'ORD-' + Date.now()
    } = req.body;

    const merchantAccount = 'www_dokee_pro';
    const merchantSecretKey = '43f8ec5981329304f616266597336518739b69c';
    const merchantDomainName = 'www.dokee.pro';
    const currency = 'KZT';
    const amount = parseFloat(totalValue).toFixed(2);
    const orderDate = Math.floor(Date.now() / 1000);

    const productNames = [productName];
    const productCounts = ['1'];
    const productPrices = [amount];

    const signatureSource = [
        merchantAccount,
        merchantDomainName,
        orderReference,
        orderDate.toString(),
        amount,
        currency,
        ...productNames,
        ...productCounts,
        ...productPrices
    ].join(';');

    const merchantSignature = crypto
        .createHash('md5')
        .update(signatureSource + merchantSecretKey)
        .digest('hex');

    return res.status(200).json({
        merchantAccount,
        merchantDomainName,
        orderReference,
        orderDate,
        amount,
        currency,
        productName: productNames,
        productCount: productCounts,
        productPrice: productPrices,
        clientEmail: email,
        merchantSignature
    });
};


export { getGeneral, updateGeneral, initWayforpayPayment };