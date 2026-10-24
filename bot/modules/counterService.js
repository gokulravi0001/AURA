const { ChannelType, PermissionsBitField } = require('discord.js');
const logger = require('../../shared/logger');

// Queue to rate-limit updates (10 minutes minimum per channel)
const channelUpdateTimestamps = new Map();
const pendingGuildUpdates = new Set();

const counterService = {
  /**
   * Queue counter updates with debouncing
   */
  queueCounterUpdate(guild, settings) {
    if (!settings.voiceCounters?.enabled || !settings.voiceCounters.counters?.length) return;

    if (pendingGuildUpdates.has(guild.id)) return;
    pendingGuildUpdates.add(guild.id);

    // Debounce update by 5 seconds
    setTimeout(async () => {
      pendingGuildUpdates.delete(guild.id);
      await this.updateCounters(guild, settings);
    }, 5000);
  },

  /**
   * Perform channel name updates
   */
  async updateCounters(guild, settings, force = false) {
    if (!guild || !settings.voiceCounters?.counters) return;

    // Fetch all guild members so bots and humans are accurately counted
    await guild.members.fetch().catch(() => {});

    const total = guild.memberCount || guild.members.cache.size || 0;
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = Math.max(0, total - bots);

    let voiceActive = 0;
    guild.channels.cache.forEach(c => {
      if (c.isVoiceBased()) {
        voiceActive += c.members.filter(m => !m.user.bot).size;
      }
    });

    const now = Date.now();
    const minInterval = force ? 3000 : (10 * 60 * 1000); // 3 seconds on force, 10 min on routine

    for (const counter of settings.voiceCounters.counters) {
      const channel = guild.channels.cache.get(counter.channelId);
      if (!channel) continue;

      const lastUpdate = channelUpdateTimestamps.get(counter.channelId) || 0;
      if (!force && (now - lastUpdate < minInterval)) {
        continue; // Respect Discord API rate limit for routine checks
      }

      let count = 0;
      let label = '';
      switch (counter.type) {
        case 'total':
          count = total;
          label = 'Total Members';
          break;
        case 'humans':
          count = humans;
          label = 'Humans';
          break;
        case 'bots':
          count = bots;
          label = 'Bots';
          break;
        case 'voice':
          count = voiceActive;
          label = 'Active in Voice';
          break;
      }

      const format = counter.format || '{label}: {count}';
      const newName = format
        .replace(/{label}/g, label)
        .replace(/{count}/g, count.toLocaleString());

      if (channel.name !== newName) {
        try {
          await channel.setName(newName);
          channelUpdateTimestamps.set(counter.channelId, now);
          logger.info(`Updated counter channel ${channel.id} to "${newName}"`);
        } catch (err) {
          logger.warn(`Failed to update counter channel ${counter.channelId}: ${err.message}`);
        }
      }
    }
  },

  /**
   * Wizard: Setup Category and Counter channels
   */
  async setupWizard(guild, selectedCounters = ['total', 'humans', 'bots', 'voice']) {
    if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      throw new Error('Bot is missing the Manage Channels permission.');
    }

    // Fetch all guild members so bot and human numbers are accurate
    await guild.members.fetch().catch(() => {});

    // 1. Create Statistics Category
    const category = await guild.channels.create({
      name: '📊 SERVER STATS',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.Connect],
          allow: [PermissionsBitField.Flags.ViewChannel]
        }
      ]
    });

    const total = guild.memberCount || guild.members.cache.size || 0;
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = Math.max(0, total - bots);

    let voiceActive = 0;
    guild.channels.cache.forEach(c => {
      if (c.isVoiceBased()) voiceActive += c.members.filter(m => !m.user.bot).size;
    });

    const createdCounters = [];

    const definitions = [
      { type: 'total', label: `Total Members: ${total.toLocaleString()}` },
      { type: 'humans', label: `Humans: ${humans.toLocaleString()}` },
      { type: 'bots', label: `Bots: ${bots.toLocaleString()}` },
      { type: 'voice', label: `Active in Voice: ${voiceActive.toLocaleString()}` }
    ];

    for (const def of definitions) {
      if (selectedCounters.includes(def.type)) {
        const channel = await guild.channels.create({
          name: def.label,
          type: ChannelType.GuildVoice,
          parent: category.id,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionsBitField.Flags.Connect],
              allow: [PermissionsBitField.Flags.ViewChannel]
            }
          ]
        });

        createdCounters.push({
          type: def.type,
          channelId: channel.id,
          format: '{label}: {count}'
        });
      }
    }

    return {
      categoryId: category.id,
      counters: createdCounters
    };
  }
};

module.exports = counterService;
