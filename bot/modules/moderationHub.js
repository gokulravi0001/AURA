const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  PermissionsBitField
} = require('discord.js');
const StickyMessage = require('../../models/StickyMessage');
const Guild = require('../../models/Guild');
const autoDeleteService = require('../../shared/autoDeleteService');
const immunityService = require('../../shared/immunityService');
const { COLORS } = require('../../shared/constants');
const { isOwnerOrAdmin } = require('../../shared/permissionHelper');

const moderationHub = {
  /**
   * Build the complete minimal interactive Moderation Hub embed
   */
  async buildHubEmbed(guild, guildDoc, user, isAdmin) {
    const guildId = guild.id;

    // 1. Sticky messages count
    const stickyCount = await StickyMessage.countDocuments({ guildId }).catch(() => 0);
    const stickyList = await StickyMessage.find({ guildId }).limit(4).catch(() => []);
    let stickyText = stickyCount > 0
      ? stickyList.map(s => `• <#${s.channelId}> — \`${s.content.substring(0, 35)}${s.content.length > 35 ? '...' : ''}\``).join('\n')
      : '*No active sticky messages*';

    // 2. Auto-Delete within 1s status
    const autoDlt = guildDoc?.autoDelete || { channels: [], users: [] };
    const silencedChannels = autoDlt.channels || [];
    const silencedUsers = autoDlt.users || [];
    let autoDltText = '';
    if (silencedChannels.length > 0 || silencedUsers.length > 0) {
      if (silencedChannels.length > 0) {
        autoDltText += `• **Channels (${silencedChannels.length}):** ${silencedChannels.map(c => `<#${c.channelId}>`).join(', ')}\n`;
      }
      if (silencedUsers.length > 0) {
        autoDltText += `• **Silenced Users (${silencedUsers.length}):** ${silencedUsers.map(u => `<@${u.userId}>`).join(', ')}`;
      }
    } else {
      autoDltText = '*No channels or users currently silenced*';
    }

    // 3. Image auto-thread status
    const threadCfg = guildDoc?.imageThreads || {};
    const threadText = threadCfg.enabled && threadCfg.channelId
      ? `• **Channel:** <#${threadCfg.channelId}> • Format: \`${threadCfg.threadNameFormat || 'Discussion - {author}'}\``
      : '*Image auto-threads not configured*';

    const embed = new EmbedBuilder()
      .setColor(COLORS.SECONDARY)
      .setTitle(`🛡️ Moderation & Chat Protection Hub — ${guild.name}`)
      .setDescription(
        'Centralized server moderation suite: Bulk message cleanup, 1-second auto-delete, persistent sticky messages, and image discussion threads.\n' +
        'Use the dropdown or quick action buttons below to manage chat moderation!'
      )
      .addFields(
        {
          name: '⚡ 1-Second Auto-Delete & Shadow Mute',
          value: autoDltText
        },
        {
          name: `📌 Sticky Messages (${stickyCount})`,
          value: stickyText
        },
        {
          name: '🧵 Image Auto-Threads',
          value: threadText
        },
        {
          name: '🧹 Quick Purge Tools',
          value: '• Purge 1-100 messages, filter by user/bots, or reply to any message with `+purge` to wipe everything sent after it!'
        }
      )
      .setFooter({ text: 'AURA Moderation Suite • Protected with immunity enforcement' })
      .setTimestamp();

    if (isAdmin) {
      embed.addFields({
        name: '🛡️ Administrator Controls Enabled',
        value: 'You can purge chat messages, apply 1-second auto-delete to spam members, configure sticky notes, and manage auto-threads.'
      });
    }

    return embed;
  },

  /**
   * Build interactive components.
   * Admin actions are strictly omitted if the caller is not an administrator.
   */
  buildHubComponents(isAdmin) {
    const components = [];

    // Row 1: Interactive Dropdown Select Menu
    const selectOptions = [
      new StringSelectMenuOptionBuilder()
        .setValue('act_mod_refresh')
        .setLabel('Refresh Moderation Status')
        .setDescription('Update active sticky messages and silenced user stats')
        .setEmoji('🔄')
    ];

    if (isAdmin) {
      selectOptions.push(
        new StringSelectMenuOptionBuilder()
          .setValue('act_mod_purge_prompt')
          .setLabel('Quick Purge Chat')
          .setDescription('Delete 1-100 recent messages or clean up bot spam')
          .setEmoji('🧹'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_mod_autodlt_prompt')
          .setLabel('Apply 1-Second Auto-Delete')
          .setDescription('Delete every message sent by a target user within 1 second')
          .setEmoji('⚡'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_mod_sticky_prompt')
          .setLabel('Create Sticky Message')
          .setDescription('Keep an important notice pinned at the bottom of chat')
          .setEmoji('📌'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_mod_thread_picker')
          .setLabel('Set Image Thread Channel')
          .setDescription('Automatically create a discussion thread under image posts')
          .setEmoji('🧵')
      );
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_mod_action')
      .setPlaceholder('⚡ Select a moderation tool or cleanup action...')
      .addOptions(selectOptions);

    components.push(new ActionRowBuilder().addComponents(selectMenu));

    // Row 2: Action Buttons
    if (isAdmin) {
      const adminRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_mod_purge')
          .setLabel('Purge Chat')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🧹'),
        new ButtonBuilder()
          .setCustomId('btn_mod_autodlt')
          .setLabel('Auto-Delete 1s')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⚡'),
        new ButtonBuilder()
          .setCustomId('btn_mod_sticky')
          .setLabel('Sticky Message')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📌'),
        new ButtonBuilder()
          .setCustomId('btn_mod_refresh')
          .setLabel('Refresh')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔄')
      );
      components.push(adminRow);
    } else {
      const memberRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_mod_refresh')
          .setLabel('Refresh Status')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔄')
      );
      components.push(memberRow);
    }

    return components;
  },

  /**
   * Handle button interactions
   */
  async handleButton(interaction, client) {
    const customId = interaction.customId;
    const isAdmin = isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client);

    if (customId === 'btn_mod_refresh') {
      const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });
      const embed = await this.buildHubEmbed(interaction.guild, guildDoc, interaction.user, isAdmin);
      const components = this.buildHubComponents(isAdmin);
      return interaction.update({ embeds: [embed], components });
    }

    if (!isAdmin) {
      return interaction.reply({ content: '🚫 Administrator or Moderator permission required.', ephemeral: true });
    }

    if (customId === 'btn_mod_purge') {
      const modal = new ModalBuilder()
        .setCustomId('modal_mod_purge')
        .setTitle('Quick Purge Messages');
      const input = new TextInputBuilder()
        .setCustomId('purge_amount')
        .setLabel('Number of messages to delete (1-100)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. 25')
        .setRequired(true)
        .setMaxLength(3);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (customId === 'btn_mod_autodlt') {
      const modal = new ModalBuilder()
        .setCustomId('modal_mod_autodlt')
        .setTitle('1-Second Auto-Delete (Shadow Mute)');
      const userInput = new TextInputBuilder()
        .setCustomId('autodlt_target')
        .setLabel('Target User ID or Mention')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. 123456789012345678 or @spammer')
        .setRequired(true);
      const durationInput = new TextInputBuilder()
        .setCustomId('autodlt_duration')
        .setLabel('Duration (e.g. 30s, 5m, 1h, or stop)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. 10m or stop')
        .setRequired(true);
      modal.addComponents(
        new ActionRowBuilder().addComponents(userInput),
        new ActionRowBuilder().addComponents(durationInput)
      );
      return interaction.showModal(modal);
    }

    if (customId === 'btn_mod_sticky') {
      const modal = new ModalBuilder()
        .setCustomId('modal_mod_sticky')
        .setTitle('Create Persistent Sticky Message');
      const textInput = new TextInputBuilder()
        .setCustomId('sticky_text')
        .setLabel('Sticky Message Notice')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Type rules or notice to keep at bottom of chat...')
        .setRequired(true)
        .setMaxLength(1000);
      modal.addComponents(new ActionRowBuilder().addComponents(textInput));
      return interaction.showModal(modal);
    }
  },

  /**
   * Handle dropdown select menu interactions
   */
  async handleSelectMenu(interaction, client) {
    const selected = interaction.values[0];
    const isAdmin = isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client);

    if (selected === 'act_mod_refresh') {
      const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });
      const embed = await this.buildHubEmbed(interaction.guild, guildDoc, interaction.user, isAdmin);
      const components = this.buildHubComponents(isAdmin);
      return interaction.update({ embeds: [embed], components });
    }

    if (!isAdmin) {
      return interaction.reply({ content: '🚫 Administrator or Moderator permission required.', ephemeral: true });
    }

    if (selected === 'act_mod_purge_prompt') {
      const modal = new ModalBuilder()
        .setCustomId('modal_mod_purge')
        .setTitle('Quick Purge Messages');
      const input = new TextInputBuilder()
        .setCustomId('purge_amount')
        .setLabel('Number of messages to delete (1-100)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. 25')
        .setRequired(true)
        .setMaxLength(3);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (selected === 'act_mod_autodlt_prompt') {
      const modal = new ModalBuilder()
        .setCustomId('modal_mod_autodlt')
        .setTitle('1-Second Auto-Delete (Shadow Mute)');
      const userInput = new TextInputBuilder()
        .setCustomId('autodlt_target')
        .setLabel('Target User ID or Mention')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. 123456789012345678')
        .setRequired(true);
      const durationInput = new TextInputBuilder()
        .setCustomId('autodlt_duration')
        .setLabel('Duration (e.g. 30s, 5m, 1h, or stop)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. 10m or stop')
        .setRequired(true);
      modal.addComponents(
        new ActionRowBuilder().addComponents(userInput),
        new ActionRowBuilder().addComponents(durationInput)
      );
      return interaction.showModal(modal);
    }

    if (selected === 'act_mod_sticky_prompt') {
      const modal = new ModalBuilder()
        .setCustomId('modal_mod_sticky')
        .setTitle('Create Persistent Sticky Message');
      const textInput = new TextInputBuilder()
        .setCustomId('sticky_text')
        .setLabel('Sticky Message Notice')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Type rules or notice to keep at bottom of chat...')
        .setRequired(true)
        .setMaxLength(1000);
      modal.addComponents(new ActionRowBuilder().addComponents(textInput));
      return interaction.showModal(modal);
    }

    if (selected === 'act_mod_thread_picker') {
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('select_mod_channel_thread')
        .setPlaceholder('🧵 Select Channel for Image Auto-Threads...')
        .setChannelTypes(ChannelType.GuildText);
      const row = new ActionRowBuilder().addComponents(channelSelect);
      return interaction.reply({
        content: '🧵 **Select the channel where AURA automatically spawns discussion threads under image posts:**',
        components: [row],
        ephemeral: true
      });
    }
  },

  /**
   * Handle modals for moderation hub
   */
  async handleModal(interaction, client) {
    const customId = interaction.customId;

    if (customId === 'modal_mod_purge') {
      const amountStr = interaction.fields.getTextInputValue('purge_amount');
      const amount = parseInt(amountStr, 10);
      if (isNaN(amount) || amount < 1 || amount > 100) {
        return interaction.reply({ content: '❌ Please enter a valid number between 1 and 100.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });
      const fetched = await interaction.channel.messages.fetch({ limit: amount }).catch(() => null);
      if (!fetched || fetched.size === 0) {
        return interaction.followUp({ content: '⚠️ No messages found to delete.', ephemeral: true });
      }

      const nonImmune = fetched.filter(m => !immunityService.isImmune(m.member || m.author, interaction.guild, client));
      const deleted = await interaction.channel.bulkDelete(nonImmune, true).catch(() => null);
      const count = deleted ? deleted.size : 0;
      return interaction.followUp({ content: `🧹 Deleted **${count}** message(s)! *(Protected immune messages were preserved)*`, ephemeral: true });
    }

    if (customId === 'modal_mod_autodlt') {
      const rawTarget = interaction.fields.getTextInputValue('autodlt_target');
      const targetId = rawTarget.replace(/[<@!>]/g, '').trim();
      const rawDuration = interaction.fields.getTextInputValue('autodlt_duration').trim();

      const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
      if (!targetMember) {
        return interaction.reply({ content: `❌ Could not find member with ID \`${targetId}\`.`, ephemeral: true });
      }

      if (rawDuration.toLowerCase() === 'stop' || rawDuration.toLowerCase() === 'remove') {
        await autoDeleteService.stopUserAutoDelete(interaction.guild.id, targetId);
        return interaction.reply({ content: `✅ 1-second auto-delete stopped for <@${targetId}>.`, ephemeral: true });
      }

      const parsed = autoDeleteService.parseDuration(rawDuration);
      if (!parsed) {
        return interaction.reply({ content: '❌ Invalid duration format. Use `30s`, `5m`, `1h`, or `stop`.', ephemeral: true });
      }

      const expiresAt = parsed.ms ? new Date(Date.now() + parsed.ms) : null;
      await autoDeleteService.setUserAutoDelete(interaction.guild.id, targetId, expiresAt, interaction.user.id);
      return interaction.reply({
        content: `⚡ 1-second auto-delete active for <@${targetId}>! Duration: **${parsed.label}**.\n*Every message they send will be automatically deleted within 1 second.*`,
        ephemeral: true
      });
    }

    if (customId === 'modal_mod_sticky') {
      const text = interaction.fields.getTextInputValue('sticky_text');
      await StickyMessage.findOneAndUpdate(
        { channelId: interaction.channel.id },
        {
          guildId: interaction.guild.id,
          channelId: interaction.channel.id,
          content: text.trim(),
          updatedAt: new Date()
        },
        { upsert: true }
      );
      return interaction.reply({
        content: `📌 Sticky message set for <#${interaction.channel.id}>! It will automatically re-post at the bottom of the channel.`,
        ephemeral: true
      });
    }
  },

  /**
   * Handle channel select menus for moderation hub
   */
  async handleChannelSelect(interaction, client) {
    if (!isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client)) {
      return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
    }

    const channelId = interaction.values[0];
    if (interaction.customId === 'select_mod_channel_thread') {
      await Guild.updateOne(
        { guildId: interaction.guild.id },
        {
          $set: {
            'modules.image_threads': true,
            'imageThreads.enabled': true,
            'imageThreads.channelId': channelId
          }
        },
        { upsert: true }
      );
      return interaction.reply({
        content: `🧵 Image auto-threads configured for <#${channelId}>! Members posting images will automatically have a discussion thread spawned.`,
        ephemeral: true
      });
    }
  }
};

module.exports = moderationHub;
