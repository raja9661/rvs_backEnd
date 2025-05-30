const mongoose = require('mongoose');

const UploadSessionSchema = new mongoose.Schema({
    uploadId: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: String,
        required: true
    },
    clientId: String,
    status: {
        type: String,
        enum: ['initiated', 'processing', 'completed', 'failed'],
        default: 'initiated'
    },
    stats: {
        totalRecords: Number,
        inserted: Number,
        fileDuplicates: Number,
        dbDuplicates: Number,
        failed: Number
    },
    metadata: {
        currentDate: String,
        ipAddress: String,
        fileName: String,
        fileSize: Number
    },
    error: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    completedAt: Date
});

module.exports = mongoose.model('UploadSession', UploadSessionSchema);