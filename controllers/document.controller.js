const Document = require('../models/document.model');
const { uploadImage } = require('../utils/uploadImage');
const sendEmail = require('../utils/sendEmail');
const General = require('../models/general.model');

const langMap = {
    'русский': 'ru',
    'украинский': 'uk',
    'английский': 'en',
    'немецкий': 'de',
    'польский': 'pl',
    'французский': 'fr',
    'итальянский': 'it',
    'испанский': 'es',
    'литовский': 'lt',
    'португальский': 'pt',
    'чешский': 'cz',
};

const createDocument = async (req, res) => {
    try {
        console.log('--- Incoming request to /create-document ---');
        console.log('req.body:', req.body);
        console.log('req.files:', req.files);

        const lastDoc = await Document.findOne().sort({ order: -1 });
        const order = lastDoc ? lastDoc.order + 1 : 1;

        const { name, languageTariffs, samples, documentCountry } = req.body;

        let parsedLanguageTariffs = [];
        let parsedSamples = [];

        // Parse tariffs
        if (typeof languageTariffs === 'string') {
            try {
                parsedLanguageTariffs = JSON.parse(languageTariffs);
                console.log('Parsed languageTariffs:', parsedLanguageTariffs);
            } catch (e) {
                console.error('Failed to parse languageTariffs:', e);
            }
        } else if (Array.isArray(languageTariffs)) {
            parsedLanguageTariffs = languageTariffs;
        }

        // Parse samples
        if (typeof samples === 'string') {
            try {
                parsedSamples = JSON.parse(samples);
                console.log('Parsed samples:', parsedSamples);
            } catch (e) {
                console.error('Failed to parse samples:', e);
            }
        }

        // Upload images for samples (if present)
        if (req.files) {
            const sampleEntries = Object.entries(req.files).filter(([key]) =>
                key.startsWith('samples')
            );

            if (sampleEntries.length > 0) {
                parsedSamples = [];
                for (const [key, file] of sampleEntries) {
                    const match = key.match(/samples\[(\d+)\]\[image\]/);
                    const idx = match ? Number(match[1]) : 0;
                    const titleKey = `samples[${idx}][title]`;
                    const title = req.body[titleKey] || `Sample ${idx + 1}`;
                    const ext = file.name ? file.name.substring(file.name.lastIndexOf('.')) : '';
                    const fileName = `document-dokee-image-${order}-${idx + 1}${ext}`;
                    const imageUrl = await uploadImage(file, fileName);
                    parsedSamples.push({ title, imageUrl });
                }
            } else if (req.files.sampleImage) {
                const file = req.files.sampleImage;
                const ext = file.name ? file.name.substring(file.name.lastIndexOf('.')) : '';
                const fileName = `document-dokee-image-${order}-1${ext}`;
                const imageUrl = await uploadImage(file, fileName);
                parsedSamples = [{ title: req.body.sampleTitle, imageUrl }];
            }
        }

        // Inject tariffs into each sample
        const samplesWithTariffs = (parsedSamples || []).map(sample => ({
            ...sample,
            languageTariffs: parsedLanguageTariffs || []
        }));

        // Save document
        const doc = new Document({
            name,
            order,
            documentCountry,
            languageTariffs: parsedLanguageTariffs,
            samples: samplesWithTariffs
        });

        await doc.save();
        console.log('Document saved:', doc);
        res.status(201).json(doc);
    } catch (err) {
        console.error('Error in createDocument:', err);
        res.status(500).json({ error: err.message });
    }
};


const getAllDocuments = async (req, res) => {
    try {
        const documents = await Document.find().sort({ order: 1 });
        res.status(200).json(documents);
    } catch (err) {
        console.log('Error in getAllDocuments:', err);
        res.status(500).json({ error: err.message });
    }
};

const initTariffsForSamples = async () => {
    try {
        const documents = await Document.find();
        for (const doc of documents) {
            if (Array.isArray(doc.samples) && Array.isArray(doc.languageTariffs)) {
                doc.samples = doc.samples.map(sample => ({
                    ...sample.toObject ? sample.toObject() : sample,
                    languageTariffs: doc.languageTariffs
                }));
                await doc.save();
                console.log(`Updated document ${doc._id} samples with languageTariffs`);
            }
        }
        console.log('All documents updated.');
    } catch (err) {
        console.error('Error in initTariffsForSamples:', err);
    }
};

const lang = (v) => (v || "").toString().trim();

const sendData = async (req, res) => {
    try {
        const email        = lang(req.body.email) || "dokee.pro@gmail.com";
        const languagePair = lang(req.body.languagePair);
        const tariff       = lang(req.body.tariff);
        const totalValue   = String(req.body.totalValue ?? "");

        let selectedDate = lang(req.body.selectedDate) || "";
        let samples = req.body.samples;
        if (typeof samples === "string") { try { samples = JSON.parse(samples); } catch { samples = []; } }
        if (!Array.isArray(samples)) samples = [];

        let html = `<h2>Новая заявка на перевод</h2>
<p><b>Языковая пара:</b> ${languagePair || "-"}</p>
<p><b>Тариф:</b> ${tariff || "-"}</p>
<p><b>Общая стоимость:</b> ${totalValue ? totalValue + " ₸" : "-"}</p>`;
        if (selectedDate) html += `<p><b>Выбранная дата:</b> ${selectedDate}</p>`;
        html += `<hr/>`;

        for (const s of samples) {
            const baseName = (s?.docName || "").replace(/\s*\(.*?\)/, "");
            const fullName = `${baseName}${s?.sampleTitle ? ` (${s.sampleTitle})` : ""}`;
            const price    = s?.computedPrice || 0;

            html += `
<h3>${baseName || "Документ"}</h3>
<b>Документ</b>: ${fullName || "-"}<br/>
<b>Языковая пара</b>: ${languagePair || "-"}<br/>
<b>Тариф</b>: ${tariff || "-"}<br/>
<b>Стоимость</b>: ${price}₸<br/>
<b>ФИО латиницей</b>: ${s?.fioLatin || "-"}<br/>
<b>Печать</b>: ${s?.sealText || "-"}<br/>
<b>Штамп</b>: ${s?.stampText || "-"}<br/>
<hr/>`;
        }

        const attachments = [];
        if (req.files && Object.keys(req.files).length) {
            const normalize = v => (Array.isArray(v) ? v : v ? [v] : []);
            const bag = req.files;
            let all = [
                ...normalize(bag.files),
                ...normalize(bag["files[]"]),
                ...Object.keys(bag).filter(k => k!=="files" && k!=="files[]").flatMap(k => normalize(bag[k])),
            ];
            all.filter(Boolean).forEach((file, idx) => {
                if (!file || typeof file !== "object") return;
                const safe = (typeof file.name === "string" && file.name.trim()) ? file.name.trim() : `upload-${Date.now()}-${idx}`;
                const extByName = safe.includes(".") ? safe.split(".").pop() : "";
                const extByMime = (typeof file.mimetype==="string" && file.mimetype.includes("/")) ? file.mimetype.split("/").pop() : "";
                const ext = String(extByName || extByMime || "bin").toLowerCase();
                const filename = extByName ? safe : `${safe}.${ext}`;
                const content = file.data || file.buffer;
                if (!content) return;
                attachments.push({ filename, content });
            });
        }

        await sendEmail(email, "Новая заявка на перевод", "", attachments.length ? attachments : undefined, html);
        return res.json({ success: true, filesAttached: attachments.length });
    } catch (err) {
        console.error("Error in sendData:", err);
        return res.status(500).json({ error: err?.message || "Server error" });
    }
};


const initRussianTariffForUaSamples = async () => {
    try {
        const documents = await Document.find({ documentCountry: 'ua' });
        for (const doc of documents) {
            let updated = false;
            if (Array.isArray(doc.samples)) {
                doc.samples.forEach(sample => {
                    if (Array.isArray(sample.languageTariffs)) {
                        sample.languageTariffs.forEach(tariff => {
                            if (tariff.language === 'русский') {
                                tariff.language = 'ru';
                                updated = true;
                            }
                        });
                    }
                });
            }
            if (updated) {
                await doc.save();
                console.log(`Updated document ${doc._id}: changed "русский" to "ru" in sample tariffs`);
            }
        }
        console.log('All UA documents processed.');
    } catch (err) {
        console.error('Error in initRussianTariffForUaSamples:', err);
    }
};

const updateSample = async (req, res) => {
    try {
        console.log('--- updateSample called ---');
        console.log('req.params:', req.params);
        console.log('req.body:', req.body);
        console.log('req.file:', req.file); // <-- multer puts the file here

        const { docId, sampleIdx } = req.params;
        const doc = await Document.findById(docId);
        if (!doc) {
            console.error('Document not found');
            return res.status(404).json({ error: 'Document not found' });
        }

        const sampleIndex = parseInt(sampleIdx, 10);
        if (isNaN(sampleIndex) || sampleIndex < 0 || sampleIndex >= doc.samples.length) {
            console.error('Invalid sample index');
            return res.status(400).json({ error: 'Invalid sample index' });
        }

        const sample = doc.samples[sampleIndex];

        const { title, languageTariffs, removeImage } = req.body;
        if (title !== undefined) sample.title = title;
        if (languageTariffs !== undefined) {
            sample.languageTariffs = Array.isArray(languageTariffs)
                ? languageTariffs
                : JSON.parse(languageTariffs);
        }

        // Use req.file for multer
        if (req.file) {
            console.log('Uploading image to R2...');
            const ext = req.file.originalname ? req.file.originalname.split('.').pop() : 'jpg';
            const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
            const fileName = `document-sample-${docId}-${sampleIndex}-${uniqueSuffix}.${ext}`;
            try {
                const imageUrl = await uploadImage(req.file, fileName); // Should upload to R2
                console.log('Image uploaded to R2:', imageUrl);
                sample.imageUrl = imageUrl;
            } catch (uploadErr) {
                console.error('Image upload error:', uploadErr);
                return res.status(500).json({ error: 'Image upload failed' });
            }
        }

        if (removeImage === 'true') {
            console.log('Removing image from sample');
            sample.imageUrl = '';
        }

        await doc.save();
        console.log('Sample updated:', sample);
        res.json(sample);
    } catch (err) {
        console.error('updateSample error:', err);
        res.status(500).json({ error: err.message });
    }
};

const deleteDocument = async (req, res) => {
    try {
        const { docId } = req.params;
        const doc = await Document.findByIdAndDelete(docId);
        if (!doc) return res.status(404).json({ error: 'Document not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateDocumentCache = async (req, res) => {
    try {
        const incomingDocs = req.body.documents;
        const currentDocs = await Document.find();

        const isDifferent = JSON.stringify(currentDocs) !== JSON.stringify(incomingDocs);

        if (isDifferent) {
            console.log("✅ Updated document cache from client");
        }

        res.json({ updated: isDifferent });
    } catch (err) {
        console.error('❌ updateDocumentCache error:', err);
        res.status(500).json({ error: err.message });
    }
};

const newRequest = async (req, res) => {
    try {
        const files = [];
        if (req.files) {
            const fileArray = Array.isArray(req.files.files) ? req.files.files : [req.files.files];
            fileArray.forEach((file) => {
                const ext = file.name?.split('.').pop() || 'pdf';
                const randomId = Math.floor(100000 + Math.random() * 900000);
                files.push({
                    filename: `offer-document-${randomId}.${ext}`,
                    content: file.data
                });
            });
        }

        const html = `<h2>Предложение на перевод документа</h2>
                      <p>Документ прикреплённый ниже</p>`;

        await sendEmail(
            "dokee.pro@gmail.com",
            "Предложение на перевод документа",
            "",
            files.length ? files : undefined,
            html
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Error in newRequest:', err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    createDocument,
    getAllDocuments,
    sendData,
    newRequest,
    deleteDocument,
    updateDocumentCache,
    initTariffsForSamples,
    updateSample
};