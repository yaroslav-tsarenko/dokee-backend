const crypto = require('crypto');

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