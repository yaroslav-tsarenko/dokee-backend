import express from 'express';
import {getGeneral, initWayforpayPayment, updateGeneral} from '../controllers/general.controller.js';

const router = express.Router();

router.get('/get-general-settings', getGeneral );
router.put('/update-general', updateGeneral);
router.post('/payment-init', initWayforpayPayment);
router.post("/general-settings/update-cache", async (req, res) => {
    try {
        const incomingGeneral = req.body.general;
        const current = await General.findOne();

        if (!current || JSON.stringify(current.toObject()) !== JSON.stringify(incomingGeneral)) {
            await General.findOneAndUpdate({}, incomingGeneral, { upsert: true });
            console.log("Updated general cache from client");
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;