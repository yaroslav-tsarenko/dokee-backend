const crypto = require('crypto');
const axios = require('axios');

const WAYFORPAY_SECRET_KEY = process.env.WAYFORPAY_SECRET_KEY;
const merchantAccount = process.env.NEXT_PUBLIC_WAYFORPAY_MERCHANT_ACCOUNT;

// Сигнатура для перевірки статусу
function generateStatusSignature(merchantAccount, orderReference) {
    const signatureString = `${merchantAccount};${orderReference}`;
    return crypto
        .createHmac('md5', WAYFORPAY_SECRET_KEY)
        .update(signatureString)
        .digest('hex');
}

exports.checkWayforpayStatus = async (req, res) => {
    try {
        const { orderReference } = req.body;

        if (!orderReference) {
            return res.status(400).json({ error: 'Missing orderReference' });
        }

        const signature = generateStatusSignature(merchantAccount, orderReference);

        const response = await axios.post('https://api.wayforpay.com/api', {
            apiVersion: 1,
            transactionType: 'CHECK_STATUS',
            merchantAccount,
            orderReference,
            merchantSignature: signature
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        return res.json(response.data);
    } catch (error) {
        console.error('WayForPay status check error:', error?.response?.data || error.message);
        return res.status(500).json({ error: 'Failed to check payment status' });
    }
};

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
