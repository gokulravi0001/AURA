/**
 * AURA Database Manager & Health Monitor
 */

const mongoose = require('mongoose');
const logger = require('./logger');

let isConnected = false;
let lastPingTime = 0;
let lastLatencyMs = 0;
let reconnectAttempts = 0;

const connectDatabase = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aura_bot';

  try {
    mongoose.connection.on('connected', () => {
      isConnected = true;
      reconnectAttempts = 0;
      logger.db('MongoDB connected successfully');
    });

    mongoose.connection.on('error', (err) => {
      isConnected = false;
      logger.error('MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      reconnectAttempts++;
      logger.warn(`MongoDB disconnected. Reconnect attempt #${reconnectAttempts}...`);
    });

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    });

    isConnected = mongoose.connection.readyState === 1;
    return mongoose.connection;
  } catch (error) {
    isConnected = false;
    logger.error(`Database connection failed: ${error.message}`);
    logger.warn('AURA will continue running, but database features will be degraded until MongoDB is available.');
    return null;
  }
};

/**
 * Perform a real ping to MongoDB and measure round-trip latency
 */
const getDatabaseHealth = async () => {
  const stateCode = mongoose.connection.readyState;
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const state = states[stateCode] || 'unknown';

  if (stateCode !== 1) {
    return {
      status: 'unhealthy',
      state,
      latencyMs: null,
      reconnectAttempts,
      timestamp: new Date().toISOString()
    };
  }

  try {
    const start = Date.now();
    await mongoose.connection.db.admin().ping();
    lastLatencyMs = Date.now() - start;
    lastPingTime = Date.now();

    return {
      status: 'healthy',
      state,
      latencyMs: lastLatencyMs,
      reconnectAttempts,
      host: mongoose.connection.host || 'cluster',
      name: mongoose.connection.name || 'aura_bot',
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return {
      status: 'degraded',
      state,
      latencyMs: null,
      error: err.message,
      reconnectAttempts,
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = {
  connectDatabase,
  getDatabaseHealth,
  getConnection: () => mongoose.connection,
  isConnected: () => mongoose.connection.readyState === 1
};
