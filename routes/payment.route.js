const express = require('express');
const router = express.Router();

const {
    generateWayforpaySignature,
    checkWayforpayStatus
} = require('../controllers/payment.controller');

router.post('/generate-wayforpay-signature', generateWayforpaySignature);
router.post('/check-wayforpay-status', checkWayforpayStatus);

module.exports = router;
