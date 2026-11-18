const mongoose = require('mongoose');
const DatabaseBackup = require('../models/DatabaseBackup');
const Guild = require('../models/Guild');
const UserXP = require('../models/UserXP');
const Ticket = require('../models/Ticket');
const Birthday = require('../models/Birthday');
const AuditLog = require('../models/AuditLog');
const SystemConfig = require('../models/SystemConfig');
const Blacklist = require('../models/Blacklist');
const logger = require('./logger');

const BACKUP_COLLECTIONS = [
  { name: 'guilds', model: Guild },
  { name: 'user_xp', model: UserXP },
  { name: 'tickets', model: Ticket },
  { name: 'birthdays', model: Birthday },
  { name: 'audit_logs', model: AuditLog },
  { name: 'system_config', model: SystemConfig },
  { name: 'blacklist', model: Blacklist }
];

const backupService = {
  /**
   * Create a full JSON snapshot backup of all vital collections
   */
  async createBackup({ name = 'Automated System Backup', description = 'Point-in-time snapshot', createdBy = 'system' } = {}) {
    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const snapshotData = {};
    const collectionSummaries = [];
    let totalDocs = 0;

    for (const item of BACKUP_COLLECTIONS) {
      try {
        const docs = await item.model.find({}).lean();
        snapshotData[item.name] = docs;
        collectionSummaries.push({
          name: item.name,
          count: docs.length
        });
        totalDocs += docs.length;
      } catch (err) {
        logger.error(`Backup error on collection ${item.name}:`, err.message);
        snapshotData[item.name] = [];
        collectionSummaries.push({ name: item.name, count: 0 });
      }
    }

    const payloadString = JSON.stringify(snapshotData);
    const sizeBytes = Buffer.byteLength(payloadString, 'utf8');

    const backupRecord = await DatabaseBackup.create({
      backupId,
      name,
      description,
      collections: collectionSummaries,
      totalDocuments: totalDocs,
      sizeBytes,
      data: snapshotData,
      createdBy,
      createdAt: new Date()
    });

    logger.info(`Database backup created: [${backupId}] (${totalDocs} documents, ${(sizeBytes / 1024).toFixed(1)} KB)`);

    return {
      backupId: backupRecord.backupId,
      name: backupRecord.name,
      totalDocuments: backupRecord.totalDocuments,
      sizeBytes: backupRecord.sizeBytes,
      collections: backupRecord.collections,
      createdAt: backupRecord.createdAt
    };
  },

  /**
   * List all stored backups
   */
  async listBackups() {
    return await DatabaseBackup.find({}, {
      backupId: 1,
      name: 1,
      description: 1,
      collections: 1,
      totalDocuments: 1,
      sizeBytes: 1,
      createdBy: 1,
      createdAt: 1
    }).sort({ createdAt: -1 }).lean();
  },

  /**
   * Restore database from a backup
   * REQUIRES confirm: true to prevent accidental execution
   */
  async restoreBackup(backupId, { confirm = false, operator = 'system' } = {}) {
    if (!confirm) {
      throw new Error('Restoration aborted: Confirmation parameter (confirm: true) is required to restore.');
    }

    const backup = await DatabaseBackup.findOne({ backupId }).lean();
    if (!backup || !backup.data) {
      throw new Error(`Backup [${backupId}] not found or contains no snapshot data.`);
    }

    logger.warn(`Restoring database from backup [${backupId}] requested by ${operator}...`);

    const results = {};

    for (const item of BACKUP_COLLECTIONS) {
      const docs = backup.data[item.name];
      if (Array.isArray(docs)) {
        try {
          if (docs.length > 0) {
            // Upsert / restore docs safely
            const bulkOps = docs.map(doc => ({
              replaceOne: {
                filter: { _id: doc._id },
                replacement: doc,
                upsert: true
              }
            }));
            const res = await item.model.bulkWrite(bulkOps);
            results[item.name] = {
              upserted: res.upsertedCount,
              modified: res.modifiedCount
            };
          } else {
            results[item.name] = { count: 0 };
          }
        } catch (err) {
          logger.error(`Error restoring collection ${item.name}:`, err.message);
          results[item.name] = { error: err.message };
        }
      }
    }

    logger.success(`Database restore from [${backupId}] completed successfully.`);
    return {
      success: true,
      backupId,
      restoredAt: new Date().toISOString(),
      results
    };
  }
};

module.exports = backupService;
