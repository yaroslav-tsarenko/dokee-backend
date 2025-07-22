const mongoose = require('mongoose');

const GeneralSchema = new mongoose.Schema({
    sitePaused: { type: Boolean, default: false },
    kzNormalSlots: { type: Number, default: 0 },
    kzExpressSlots: { type: Number, default: 0 },
    kzFastSlots: { type: Number, default: 0 },
    uaNormalSlots: { type: Number, default: 0 },
    uaExpressSlots: { type: Number, default: 0 },
    uaFastSlots: { type: Number, default: 0 },
});

module.exports = mongoose.model('General', GeneralSchema);