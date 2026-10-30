const {
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const TempVoice = require('../../models/TempVoice');
const logger = require('../../shared/logger');
const { COLORS } = require('../../shared/constants');

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
   * Build the control panel components
   */
  buildControlPanel(channel, member) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setAuthor({
        name: `${member.user.username}'s Custom Lounge`,
        iconURL: member.user.displayAvatarURL({ dynamic: true })
      })
      .setTitle('🔊 Voice Channel Control Panel')
      .setDescription(
        `Welcome to your private custom voice lounge, <@${member.id}>!\n` +
        `Use the interactive buttons below to customize and control your room:\n\n` +
        `🔒 **Lock** — Prevent other members from connecting\n` +
        `🔓 **Unlock** — Allow anyone to connect\n` +
        `👻 **Hide** — Make channel invisible in server list\n` +
        `👁️ **Show** — Make channel visible to everyone\n` +
        `✏️ **Rename** — Change your channel's name\n` +
        `👥 **Limit** — Change member capacity (0 = Unlimited)\n` +
        `👑 **Claim** — Claim ownership if creator leaves\n` +
        `🗑️ **Delete** — Delete channel immediately`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: 'AURA Custom Voice • Auto-deletes when empty' })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('vc_lock')
        .setLabel('Lock')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('vc_unlock')
        .setLabel('Unlock')
        .setEmoji('🔓')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('vc_hide')
        .setLabel('Hide')
        .setEmoji('👻')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('vc_show')
        .setLabel('Show')
        .setEmoji('👁️')
        .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('vc_rename')
        .setLabel('Rename')
        .setEmoji('✏️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('vc_limit')
        .setLabel('Limit')
        .setEmoji('👥')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('vc_claim')
        .setLabel('Claim')
        .setEmoji('👑')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('vc_delete')
        .setLabel('Delete')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [row1, row2] };
  },

  /**
   * Send the customization embed panel into the newly created temp voice channel
   */
  async sendControlPanel(channel, member) {
    try {
      const panelData = this.buildControlPanel(channel, member);
      const sent = await channel.send({
        content: `👋 <@${member.id}>, your custom voice channel is ready! Customize it below:`,
        embeds: panelData.embeds,
        components: panelData.components
      });
      return sent.id;
    } catch (err) {
      logger.warn(`Could not send voice control panel in channel ${channel?.id}: ${err.message}`);
      return null;
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

      // Create private/custom channel with permissions allowing member and bot to talk/read
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
              PermissionsBitField.Flags.Speak,
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory
            ]
          },
          {
            id: guild.members.me.id,
            allow: [
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.MoveMembers,
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.Speak,
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.EmbedLinks,
              PermissionsBitField.Flags.ReadMessageHistory
            ]
          }
        ]
      });

      // Move member into new channel
      await member.voice.setChannel(newChannel);

      // Send the interactive customization control panel
      const panelMessageId = await this.sendControlPanel(newChannel, member);

      // Record temporary channel in MongoDB
      await TempVoice.create({
        guildId: guild.id,
        channelId: newChannel.id,
        ownerId: member.id,
        panelMessageId: panelMessageId || null
      });

      logger.info(`Created temporary voice channel "${channelName}" for ${member.user.tag} with control panel`);
    } catch (err) {
      logger.error('Error creating temporary voice channel:', err.message);
    }
  },

  /**
   * Handle button interactions for voice controls
   */
  async handleButton(interaction, client) {
    const customId = interaction.customId;
    const guild = interaction.guild;
    if (!guild) return;

    // Find the temporary voice channel
    const voiceChannel = interaction.member?.voice?.channel;
    let tempDoc = await TempVoice.findOne({ channelId: interaction.channelId });
    let targetChannel = interaction.channel;

    if (!tempDoc && voiceChannel) {
      tempDoc = await TempVoice.findOne({ channelId: voiceChannel.id });
      targetChannel = voiceChannel;
    }

    if (!tempDoc) {
      return interaction.reply({
        content: '❌ This channel is not a bot-managed temporary voice lounge.',
        ephemeral: true
      });
    }

    // Verify user is connected to this voice channel
    if (interaction.member?.voice?.channelId !== tempDoc.channelId) {
      return interaction.reply({
        content: '❌ You must be connected to this temporary voice channel to use the controls.',
        ephemeral: true
      });
    }

    const isOwner = tempDoc.ownerId === interaction.user.id;
    const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

    // 1. CLAIM OWNERSHIP
    if (customId === 'vc_claim') {
      if (isOwner) {
        return interaction.reply({
          content: '❌ You are already the owner of this voice channel.',
          ephemeral: true
        });
      }

      // Check if original owner is still connected
      const currentOwner = targetChannel.members.get(tempDoc.ownerId);
      if (currentOwner) {
        return interaction.reply({
          content: `❌ The channel owner <@${tempDoc.ownerId}> is still in this voice channel. You cannot claim it while they are connected.`,
          ephemeral: true
        });
      }

      tempDoc.ownerId = interaction.user.id;
      await tempDoc.save();

      await targetChannel.permissionOverwrites.edit(interaction.user.id, {
        ManageChannels: true,
        MoveMembers: true,
        Connect: true,
        Speak: true
      }).catch(() => {});

      return interaction.reply({
        content: `👑 <@${interaction.user.id}> has claimed ownership of this channel!`
      });
    }

    // All other controls require owner or administrator
    if (!isOwner && !isAdmin) {
      return interaction.reply({
        content: '🚫 Only the channel owner or an administrator can customize this voice lounge.',
        ephemeral: true
      });
    }

    // 2. LOCK
    if (customId === 'vc_lock') {
      await targetChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false }).catch(() => {});
      tempDoc.isLocked = true;
      await tempDoc.save();
      return interaction.reply({
        content: '🔒 Voice channel **locked**! Nobody else can connect.',
        ephemeral: true
      });
    }

    // 3. UNLOCK
    if (customId === 'vc_unlock') {
      await targetChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: true }).catch(() => {});
      tempDoc.isLocked = false;
      await tempDoc.save();
      return interaction.reply({
        content: '🔓 Voice channel **unlocked**! Members can connect.',
        ephemeral: true
      });
    }

    // 4. HIDE
    if (customId === 'vc_hide') {
      await targetChannel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }).catch(() => {});
      tempDoc.isHidden = true;
      await tempDoc.save();
      return interaction.reply({
        content: '👻 Voice channel **hidden** from @everyone in the server channel list.',
        ephemeral: true
      });
    }

    // 5. SHOW
    if (customId === 'vc_show') {
      await targetChannel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: true }).catch(() => {});
      tempDoc.isHidden = false;
      await tempDoc.save();
      return interaction.reply({
        content: '👁️ Voice channel is now **visible** to @everyone.',
        ephemeral: true
      });
    }

    // 6. RENAME (Modal)
    if (customId === 'vc_rename') {
      const modal = new ModalBuilder()
        .setCustomId(`modal_vc_rename_${targetChannel.id}`)
        .setTitle('Rename Voice Channel');

      const nameInput = new TextInputBuilder()
        .setCustomId('vc_new_name')
        .setLabel('New Channel Name')
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(100)
        .setPlaceholder('e.g. 🎮 Gaming Lounge')
        .setRequired(true)
        .setValue(targetChannel.name);

      modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
      return await interaction.showModal(modal);
    }

    // 7. LIMIT (Modal)
    if (customId === 'vc_limit') {
      const modal = new ModalBuilder()
        .setCustomId(`modal_vc_limit_${targetChannel.id}`)
        .setTitle('Set Member Limit');

      const limitInput = new TextInputBuilder()
        .setCustomId('vc_new_limit')
        .setLabel('User Limit (0 = Unlimited, 1 - 99)')
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(2)
        .setPlaceholder('0')
        .setRequired(true)
        .setValue(String(targetChannel.userLimit || 0));

      modal.addComponents(new ActionRowBuilder().addComponents(limitInput));
      return await interaction.showModal(modal);
    }

    // 8. DELETE
    if (customId === 'vc_delete') {
      await interaction.reply({
        content: '🗑️ Closing and deleting temporary voice channel...',
        ephemeral: true
      });
      await TempVoice.deleteOne({ channelId: targetChannel.id });
      await targetChannel.delete('Deleted by channel owner via control panel').catch(() => {});
    }
  },

  /**
   * Handle modal submission for voice controls
   */
  async handleModal(interaction, client) {
    const customId = interaction.customId;
    const guild = interaction.guild;
    if (!guild) return;

    if (customId.startsWith('modal_vc_rename_')) {
      const channelId = customId.replace('modal_vc_rename_', '');
      const tempDoc = await TempVoice.findOne({ channelId });
      const channel = guild.channels.cache.get(channelId);

      if (!tempDoc || !channel) {
        return interaction.reply({ content: '❌ Temporary voice channel not found or already deleted.', ephemeral: true });
      }

      const isOwner = tempDoc.ownerId === interaction.user.id;
      const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!isOwner && !isAdmin) {
        return interaction.reply({ content: '🚫 Only the channel owner can rename this channel.', ephemeral: true });
      }

      const newName = interaction.fields.getTextInputValue('vc_new_name').trim();
      try {
        await channel.setName(newName);
        return interaction.reply({ content: `✏️ Renamed voice channel to **"${newName}"**!`, ephemeral: true });
      } catch (err) {
        return interaction.reply({ content: `⚠️ Could not rename channel: ${err.message}. (Note: Discord limits channel renames to twice per 10 minutes)`, ephemeral: true });
      }
    }

    if (customId.startsWith('modal_vc_limit_')) {
      const channelId = customId.replace('modal_vc_limit_', '');
      const tempDoc = await TempVoice.findOne({ channelId });
      const channel = guild.channels.cache.get(channelId);

      if (!tempDoc || !channel) {
        return interaction.reply({ content: '❌ Temporary voice channel not found or already deleted.', ephemeral: true });
      }

      const isOwner = tempDoc.ownerId === interaction.user.id;
      const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!isOwner && !isAdmin) {
        return interaction.reply({ content: '🚫 Only the channel owner can set the limit.', ephemeral: true });
      }

      const limitStr = interaction.fields.getTextInputValue('vc_new_limit').trim();
      const limit = parseInt(limitStr, 10);
      if (isNaN(limit) || limit < 0 || limit > 99) {
        return interaction.reply({ content: '❌ Invalid limit. Please enter a number between 0 and 99 (0 for unlimited).', ephemeral: true });
      }

      try {
        await channel.setUserLimit(limit);
        return interaction.reply({ content: `👥 User limit set to **${limit === 0 ? 'unlimited' : limit}**!`, ephemeral: true });
      } catch (err) {
        return interaction.reply({ content: `⚠️ Could not update user limit: ${err.message}`, ephemeral: true });
      }
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
