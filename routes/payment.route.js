const express = require('express');
const {generateWayforpaySignature} = require("../controllers/payment.controller");
const router = express.Router();

router.post('/generate-wayforpay-signature', generateWayforpaySignature);

module.exports = router;