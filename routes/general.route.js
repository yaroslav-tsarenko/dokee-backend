import express from 'express';
import {getGeneral, initWayforpayPayment, updateGeneral} from '../controllers/general.controller.js';

const router = express.Router();

router.get('/get-general-settings', getGeneral );
router.put('/update-general', updateGeneral);
router.post('/payment-init', initWayforpayPayment);

export default router;