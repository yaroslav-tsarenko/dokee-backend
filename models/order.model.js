const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    orderReference: { type: String, required: true, unique: true },
    selectedSamples: { type: Array, default: [] },
    fromLanguage: String,
    toLanguage: String,
    tariff: String,
    localLanguagePair: String,
    totalPriceNormal: Number,
    totalPriceExpress: Number,
    totalPriceFast: Number,
    selectedDate: String,
    uploadedFiles: { type: Array, default: [] },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', OrderSchema);