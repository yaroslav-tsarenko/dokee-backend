const mongoose = require('mongoose');

const LanguageTariffSchema = new mongoose.Schema({
    language: String,
    normal: Number,
    express: Number,
    fast: Number,
});

const SampleSchema = new mongoose.Schema({
    title: String,
    imageUrl: String,
    languageTariffs: [LanguageTariffSchema],
});

const DocumentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    order: { type: Number, unique: true, required: true },
    documentCountry: { type: String, enum: ['ua', 'kz'], required: true },
    languageTariffs: [LanguageTariffSchema],
    samples: [SampleSchema],
});

module.exports = mongoose.model('Document', DocumentSchema);