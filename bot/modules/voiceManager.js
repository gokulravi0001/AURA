const { ChannelType, PermissionsBitField } = require('discord.js');
const TempVoice = require('../../models/TempVoice');
const logger = require('../../shared/logger');

const voiceManager = {
  /**
   * Handle member joining or leaving voice
   */
  async handleVoiceStateUpdate(oldState, newState, settings, client) {
    const triggerChannelId = settings.joinToCreate.channelId;
    if (!triggerChannelId) return;

    // 1. User Joined the "Join to Create" trigger channel
    if (newState.channelId === triggerChannelId) {
      await this.createTemporaryChannel(newState, settings);
    }

    // 2. User Left a voice channel -> check if it was an empty temporary channel
    if (oldState.channelId && oldState.channelId !== triggerChannelId) {
      await this.checkEmptyChannel(oldState.channel);
    }
  },

  /**
   * Create dynamic temporary voice channel
   */
  async createTemporaryChannel(voiceState, settings) {
    const { guild, member } = voiceState;
    if (!guild || !member) return;

    try {
      const parentCategory = settings.joinToCreate.categoryId || voiceState.channel?.parentId;
      const rawFormat = settings.joinToCreate.channelNameFormat || "🔊 {username}'s Lounge";
      const channelName = rawFormat
        .replace(/{username}/g, member.user.username)
        .replace(/{tag}/g, member.user.tag);

      // Create private/custom channel
      const newChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: parentCategory || undefined,
        userLimit: settings.joinToCreate.userLimit || 0,
        bitrate: settings.joinToCreate.bitrate || 64000,
        permissionOverwrites: [
          {
            id: member.id,
            allow: [
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.MoveMembers,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak
            ]
          }
        ]
      });

      // Move member into new channel
      await member.voice.setChannel(newChannel);

      // Record temporary channel in MongoDB
      await TempVoice.create({
        guildId: guild.id,
        channelId: newChannel.id,
        ownerId: member.id
      });

      logger.info(`Created temporary voice channel "${channelName}" for ${member.user.tag}`);
    } catch (err) {
      logger.error('Error creating temporary voice channel:', err.message);
    }
  },

  /**
   * Check and delete if channel is empty
   */
  async checkEmptyChannel(channel) {
    if (!channel || !channel.isVoiceBased()) return;

    try {
      const record = await TempVoice.findOne({ channelId: channel.id });
      if (!record) return; // Not a bot-managed temporary channel

      // If no members left in channel
      if (channel.members.size === 0) {
        await channel.delete('Temporary voice channel is empty');
        await TempVoice.deleteOne({ channelId: channel.id });
        logger.info(`Deleted empty temporary voice channel: ${channel.id}`);
      }
    } catch (err) {
      logger.error(`Error deleting empty temp channel ${channel?.id}:`, err.message);
    }
  },

  /**
   * Startup Recovery: clean up orphaned temp channels
   */
  async recoverTempChannels(client) {
    try {
      const tempChannels = await TempVoice.find();
      for (const record of tempChannels) {
        const guild = client.guilds.cache.get(record.guildId);
        if (!guild) {
          await TempVoice.deleteOne({ _id: record._id });
          continue;
        }

        const channel = guild.channels.cache.get(record.channelId);
        if (!channel) {
          await TempVoice.deleteOne({ _id: record._id });
          continue;
        }

        if (channel.members.size === 0) {
          await channel.delete('Purging orphaned empty temp voice channel');
          await TempVoice.deleteOne({ _id: record._id });
          logger.info(`Startup recovery purged orphaned temp channel: ${channel.name}`);
        }
      }
    } catch (err) {
      logger.error('Error during temp voice startup recovery:', err.message);
    }
  }
};

module.exports = voiceManager;
