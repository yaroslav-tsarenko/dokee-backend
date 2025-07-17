const General = require('../models/general.model');

const getGeneral = async (req, res) => {
    let general = await General.findOne();
    if (!general) {
        general = new General();
        await general.save();
    }
    res.set('Cache-Control', 'no-store');
    res.json(general);
};

const updateGeneral = async (req, res) => {
    let general = await General.findOne();
    if (!general) {
        general = new General();
    }
    Object.assign(general, req.body);
    await general.save();

    res.set('Cache-Control', 'no-store');
    res.json(general);
};

module.exports = { getGeneral, updateGeneral };