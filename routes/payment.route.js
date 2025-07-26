require('dotenv').config();
const express = require('express');
const router = express.Router();

const {
    generateWayforpaySignature,
    checkWayforpayStatus
} = require('../controllers/payment.controller');

const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;

router.post('/generate-wayforpay-signature', generateWayforpaySignature);
router.post('/check-wayforpay-status', checkWayforpayStatus);
router.all("/redirect-to-dokee", (req, res) => {
    return res.redirect(`${frontendUrl}/check-payment-status`);
});

module.exports = router;