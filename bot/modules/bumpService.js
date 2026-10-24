const cron = require('node-cron');
const Guild = require('../../models/Guild');
const logger = require('../../shared/logger');
const { COLORS } = require('../../shared/constants');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const bumpService = {
  /**
   * Initialize cron job to check pending bump reminders every minute
   */
  init(client) {
    cron.schedule('* * * * *', async () => {
      await this.checkDueReminders(client);
    });
  },

  /**
   * Check for due bump reminders across all guilds
   */
  async checkDueReminders(client) {
    try {
      const now = new Date();
      const guilds = await Guild.find({
        'modules.bump_reminder': true,
        'bumpReminder.enabled': true,
        'bumpReminder.nextBumpTime': { $lte: now, $ne: null }
      });

      for (const guildDoc of guilds) {
        const guild = client.guilds.cache.get(guildDoc.guildId);
        if (!guild) continue;

        const channelId = guildDoc.bumpReminder.channelId;
        const channel = channelId ? guild.channels.cache.get(channelId) : null;
        if (!channel || !channel.isTextBased()) continue;

        const roleMention = guildDoc.bumpReminder.reminderRoleId
          ? `<@&${guildDoc.bumpReminder.reminderRoleId}>`
          : '@here';

        const rawMsg = guildDoc.bumpReminder.reminderMessage || '⏰ **Bump Reminder!** It is time to bump the server using `/bump`! {role}';
        const formattedMsg = rawMsg.replace(/{role}/g, roleMention);

        const embed = new EmbedBuilder()
          .setColor(COLORS.SECONDARY)
          .setTitle('🚀 Time to Bump the Server!')
          .setDescription(`${formattedMsg}\n\nHelp us grow by running \`/bump\` right now! Once you have bumped, click the button below to reset the reminder timer.`)
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('bump_confirm')
            .setLabel('I Just Bumped!')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✨')
        );

        await channel.send({ content: roleMention, embeds: [embed], components: [row] }).catch(() => {});

        // Clear nextBumpTime so duplicate reminders are not sent every minute
        guildDoc.bumpReminder.nextBumpTime = null;
        await guildDoc.save();
      }
    } catch (err) {
      logger.error('Error checking bump reminders:', err);
    }
  },

  /**
   * Auto-detect Disboard or third-party bump bot messages
   */
  async checkBotBumpMessage(message, settings) {
    // Disboard Bot ID: 302050872383242240
    const isDisboard = message.author.id === '302050872383242240';
    const hasBumpText = message.embeds?.some(e =>
      e.description?.includes('Bump done') ||
      e.description?.includes('bypassed') ||
      e.description?.includes('Check it on DISBOARD')
    ) || message.content?.toLowerCase().includes('bump done');

    if (isDisboard || hasBumpText) {
      await this.registerBump(message.guild.id, message.channel.id);
    }
  },

  /**
   * Register a completed bump (from bot detection or user manual action)
   */
  async registerBump(guildId, channelId = null) {
    try {
      const guildDoc = await Guild.findOne({ guildId });
      if (!guildDoc) return;

      const intervalMinutes = guildDoc.bumpReminder?.intervalMinutes || 120;
      const now = new Date();
      const nextBump = new Date(now.getTime() + intervalMinutes * 60 * 1000);

      guildDoc.bumpReminder.lastBumpTime = now;
      guildDoc.bumpReminder.nextBumpTime = nextBump;
      if (channelId && !guildDoc.bumpReminder.channelId) {
        guildDoc.bumpReminder.channelId = channelId;
      }
      await guildDoc.save();

      logger.info(`Registered bump for guild ${guildId}. Next reminder at: ${nextBump.toISOString()}`);
      return nextBump;
    } catch (err) {
      logger.error('Error registering bump:', err);
      return null;
    }
  },

  /**
   * Handle user clicking the "I Just Bumped!" confirmation button
   */
  async handleConfirmButton(interaction, client) {
    const nextBump = await this.registerBump(interaction.guildId, interaction.channelId);

    if (nextBump) {
      const minutes = Math.round((nextBump.getTime() - Date.now()) / 60000);
      return interaction.reply({
        content: `🎉 Awesome, thank you for bumping! Next reminder scheduled in **${minutes} minutes**.`,
        ephemeral: false
      });
    } else {
      return interaction.reply({
        content: '⚠️ Failed to update bump reminder schedule. Please check permissions.',
        ephemeral: true
      });
    }
  }
};

module.exports = bumpService;
