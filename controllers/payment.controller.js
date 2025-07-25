const crypto = require('crypto');
const axios = require('axios');

const WAYFORPAY_SECRET_KEY = process.env.WAYFORPAY_SECRET_KEY;

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

    // Flatten arrays for productName, productCount, productPrice
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


    const WAYFORPAY_SECRET_KEY = process.env.WAYFORPAY_SECRET_KEY;
    const merchantAccount = process.env.NEXT_PUBLIC_WAYFORPAY_MERCHANT_ACCOUNT;

    const { orderReference } = req.body;

    const time = Math.floor(Date.now() / 1000);

    const signatureString = `${merchantAccount};${orderReference};${time}`;
    const signature = crypto.createHmac('md5', WAYFORPAY_SECRET_KEY).update(signatureString).digest('hex');

    const payload = {
        transactionType: "CHECK_STATUS",
        merchantAccount,
        orderReference,
        merchantSignature: signature,
        apiVersion: 1,
        orderDate: time
    };

    try {
        const response = await axios.post("https://api.wayforpay.com/api", payload);
        return res.json(response.data);
    } catch (err) {
        console.error("WayForPay check status error", err?.response?.data || err);
        return res.status(500).json({ error: "Failed to check status" });
    }
};
