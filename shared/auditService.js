const AuditLog = require('../models/AuditLog');
const logger = require('./logger');

const auditService = {
  /**
   * Record an administrative action in the audit trail
   */
  async recordAction({
    guildId = null,
    action,
    executorId,
    executorName = 'Unknown',
    targetId = null,
    targetName = null,
    details = {},
    ipAddress = null
  }) {
    try {
      const sanitizedDetails = logger.maskSensitive(details);

      const log = await AuditLog.create({
        guildId,
        action,
        executorId,
        executorName,
        targetId,
        targetName,
        details: sanitizedDetails,
        ipAddress,
        createdAt: new Date()
      });

      logger.info(`[AuditTrail] ${action} executed by ${executorName} (${executorId})${guildId ? ` in Guild: ${guildId}` : ' [Global]'}`);
      return log;
    } catch (err) {
      logger.error('Failed to write audit log:', err.message);
      return null;
    }
  },

  /**
   * Fetch recent audit logs with optional guild or action filter
   */
  async getAuditLogs({ guildId = null, limit = 50 } = {}) {
    const query = {};
    if (guildId) query.guildId = guildId;

    return await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
};

module.exports = auditService;
