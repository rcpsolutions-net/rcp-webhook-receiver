// src/plugins/mongoose.js

const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');

const webhookInModel = require('../models/webhookIn');

let config = {
    mongoUri: process.env.MONGODB_URI,
  };


async function connectToMongoDB(fastify, options) {
  try {
    fastify.log.info(`Connecting to MongoDB at some address....`);
    
    await mongoose.connect(config.mongoUri);

    fastify.log.info('MongoDB connected successfully!');

  } catch (err) {
    fastify.log.error({ err }, 'MongoDB connection failed!');
    // Depending on your requirements, you might want to gracefully shut down the app here    
    // process.exit(1);
  }
}



module.exports = {
  connect: connectToMongoDB,
  db: {
    mongo: mongoose,
    webhookIn: webhookInModel,
  }
}