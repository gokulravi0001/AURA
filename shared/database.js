/**
 * AURA Database Manager
 */

const mongoose = require('mongoose');
const logger = require('./logger');

const connectDatabase = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aura_bot';

  try {
    mongoose.connection.on('connected', () => {
      logger.db('MongoDB connected successfully');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    });

    return mongoose.connection;
  } catch (error) {
    logger.error(`Database connection failed: ${error.message}`);
    logger.warn('AURA will continue running, but database features will be degraded until MongoDB is available.');
    return null;
  }
};

module.exports = { connectDatabase };
