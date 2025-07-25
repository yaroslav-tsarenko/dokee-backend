const crypto = require('crypto');
const axios = require('axios');

const WAYFORPAY_SECRET_KEY = process.env.WAYFORPAY_SECRET_KEY;
const merchantAccount = process.env.NEXT_PUBLIC_WAYFORPAY_MERCHANT_ACCOUNT;

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
    const hash = crypto.createHmac('md5', WAYFORPAY_SECRET_KEY)
        .update(signatureString)
        .digest('hex');
    return hash;
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

exports.checkWayforpayStatus = async (req, res) => {
    const { order, date } = req.params;

    if (!order || !date) {
        return res.status(400).json({ error: "Missing order reference or date" });
    }

    const orderReference = order;
    const orderDate = parseInt(date, 10);

    const signatureString = `${merchantAccount};${orderReference};${orderDate}`;
    const merchantSignature = crypto
        .createHmac('md5', WAYFORPAY_SECRET_KEY)
        .update(signatureString)
        .digest('hex');

    const payload = {
        transactionType: "CHECK_STATUS",
        apiVersion: 1,
        merchantAccount,
        orderReference,
        orderDate,
        merchantSignature
    };

    try {
        const response = await axios.post("https://api.wayforpay.com/api", payload);
        return res.status(200).json(response.data);
    } catch (err) {
        console.error("WayForPay check status error:", err?.response?.data || err);
        return res.status(500).json({ error: "Failed to check payment status" });
    }
};


