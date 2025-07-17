const express = require('express');
const { createDocument, getAllDocuments, deleteSample, updateSample, sendData } = require("../controllers/document.controller");
const router = express.Router();

router.delete('/:docId/samples/:sampleIdx', deleteSample);
router.post('/send-data', sendData);
router.post('/create-document', createDocument);
router.get('/get-all-documents', getAllDocuments);
router.patch('/:docId/samples/:sampleIdx', updateSample);

module.exports = router;