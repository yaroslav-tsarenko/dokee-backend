const AWS = require('aws-sdk');
require('dotenv').config();

const s3 = new AWS.S3({
    endpoint: "https://351efc4ab41db8b9c50631315063682f.r2.cloudflarestorage.com",
    accessKeyId: "f0576931b32e30002db9a3ac4a531193",
    secretAccessKey: "9a7707eedca5c4c35bae4563b8f7c3c17f430b5f455df45c6eafe4f3b7f95d8b",
    signatureVersion: 'v4',
    s3ForcePathStyle: true,
});

const uploadImage = async (file, fileName) => {
    if (!file) throw new Error("Файл отсутствует");

    const buffer = file.buffer || file.data;
    const mimetype = file.mimetype || file.type || 'application/octet-stream';

    if (!buffer) throw new Error("File buffer/data is missing");

    const params = {
        Bucket: "images",
        Key: fileName,
        Body: buffer,
        ContentType: mimetype,
        ACL: 'public-read',
    };

    await s3.upload(params).promise();

    return `https://cdn.allship.ai/${fileName}`;
};

module.exports = { uploadImage };
