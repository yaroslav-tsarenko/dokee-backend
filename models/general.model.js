const mongoose = require('mongoose');

const GeneralSchema = new mongoose.Schema({
    sitePaused: { type: Boolean, default: false },
    normalSlots: { type: Number, required: false },
    expressSlots: { type: Number, required: false },
    fastSlots: { type: Number, required: false },
});

module.exports = mongoose.model('General', GeneralSchema);