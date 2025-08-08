const express = require('express');
const { createDocument, getAllDocuments, deleteDocument, newRequest, updateSample, sendData } = require("../controllers/document.controller");
const router = express.Router();

router.delete('/:docId', deleteDocument);
router.post('/send-data', sendData);
router.post('/create-document', createDocument);
router.get('/get-all-documents', getAllDocuments);
router.post('/new-request', newRequest);
router.patch('/:docId/samples/:sampleIdx', updateSample);
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