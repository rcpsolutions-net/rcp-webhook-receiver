const mongoose = require('mongoose');

const webhookInSchema = new mongoose.Schema({

    provider: {
        type: String,
        default: 'system',
        required: false,
    },

    eventName: {
        type: String,
        default: null,
        required: true,    
    },

    payload: {
        type: Object,
        default: null,
        required: true,
    },

    processed: {
        type: Boolean,
        default: false,
        required: false,
    },

}, {
    collection: 'incoming-webhooks',
    timestamps: true,
    versionKey: false,      
    createIndexes: true,
});

const model = mongoose.model('incoming-webhooks', webhookInSchema);

module.exports = model;





