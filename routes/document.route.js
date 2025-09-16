const express = require('express');
const { createDocument, getAllDocuments, deleteDocument, newRequest, updateSample, sendData } = require("../controllers/document.controller");
const router = express.Router();
const multer = require('multer');
const upload = multer();

router.delete('/:docId', deleteDocument);
router.post('/send-data', sendData);
router.post('/create-document', upload.any(), createDocument);
router.get('/get-all-documents', getAllDocuments);
router.post('/new-request', upload.any(), newRequest);
router.patch('/:docId/samples/:sampleIdx', upload.single('image'), updateSample);
router.post("/documents/update-cache", async (req, res) => {
    try {
        const incomingDocs = req.body.documents;
        const currentDocs = await Document.find();

        const isDifferent = JSON.stringify(currentDocs) !== JSON.stringify(incomingDocs);

        if (isDifferent) {
            console.log("Updated document cache from client");
        }

        res.json({ updated: isDifferent });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;