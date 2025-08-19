const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const orderController = require('../controllers/order.controller.js');

const FILES_DIR = path.join(__dirname, '..', 'files');
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, FILES_DIR),
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}-${Math.round(Math.random()*1e9)}-${safeName}`);
    },
});
const upload = multer({ storage });

router.post('/save-order', upload.array('files'), orderController.saveOrder);

module.exports = router;
