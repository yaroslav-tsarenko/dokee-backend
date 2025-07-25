const express = require('express');
const router = express.Router();

const {
    generateWayforpaySignature,
    checkWayforpayStatus
} = require('../controllers/payment.controller');

router.post('/generate-wayforpay-signature', generateWayforpaySignature);
router.get('/check-wayforpay-status/:order/:date', checkWayforpayStatus);

module.exports = router;
