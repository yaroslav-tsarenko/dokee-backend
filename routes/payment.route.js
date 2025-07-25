const express = require('express');
const {generateWayforpaySignature} = require("../controllers/payment.controller");
const router = express.Router();
const { checkWayforpayStatus } = require('../controllers/payment.controller');

router.post('/check-wayforpay-status', checkWayforpayStatus);
router.post('/generate-wayforpay-signature', generateWayforpaySignature);

module.exports = router;