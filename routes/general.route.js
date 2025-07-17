import express from 'express';
import {getGeneral, updateGeneral} from '../controllers/general.controller.js';

const router = express.Router();

router.get('/get-general-settings', getGeneral );
router.put('/update-general', updateGeneral);

export default router;