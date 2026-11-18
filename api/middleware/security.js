const rateLimit = require('express-rate-limit');
const client = require('../../bot/client');
const { isBotOwner } = require('../../shared/permissionHelper');
const logger = require('../../shared/logger');

// General API rate limiter: 120 requests per minute
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again later.' }
});

// Sensitive mutation rate limiter: 30 requests per minute
const sensitiveRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded for administrative actions. Please wait a minute.' }
});

/**
 * Strict Developer-Only Middleware
 * Ordinary server administrators are strictly forbidden from accessing developer controls.
 */
const requireDeveloper = (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Authentication required. Please log in with Discord.' });
  }

  const userId = req.session.user.id;
  if (!isBotOwner(userId, client)) {
    logger.warn(`[Security] Unauthorized access attempt to Developer endpoint by user ${userId} (${req.session.user.username})`);
    return res.status(403).json({ error: 'Access denied. This section is strictly restricted to AURA Bot Developers.' });
  }

  next();
};

/**
 * Input validation & Prototype pollution prevention middleware
 */
const sanitizeInput = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    const cleanObject = (obj) => {
      for (const key of Object.keys(obj)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          delete obj[key];
          continue;
        }
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          cleanObject(obj[key]);
        }
      }
    };
    cleanObject(req.body);
  }
  next();
};

module.exports = {
  apiRateLimiter,
  sensitiveRateLimiter,
  requireDeveloper,
  sanitizeInput
};
