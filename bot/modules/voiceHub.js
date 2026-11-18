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
  ChannelType,
  PermissionsBitField
} = require('discord.js');
const TempVoice = require('../../models/TempVoice');
const Guild = require('../../models/Guild');
const guildService = require('../../shared/guildService');
const voiceManager = require('./voiceManager');
const bounceManager = require('./bounceManager');
const immunityService = require('../../shared/immunityService');
const { COLORS } = require('../../shared/constants');
const { isOwnerOrAdmin } = require('../../shared/permissionHelper');

const voiceHub = {
  /**
   * Build the complete minimal interactive Voice Hub embed
   */
  async buildHubEmbed(guild, guildDoc, member, isAdmin) {
    const jtc = guildDoc?.joinToCreate || {};
    const isConfigured = Boolean(jtc.channelId && jtc.categoryId);
    const triggerText = jtc.channelId ? `<#${jtc.channelId}>` : '`Not configured` *(Admin setup)*';
    const categoryText = jtc.categoryId ? `<#${jtc.categoryId}>` : '`Not configured`';

    const activeLounges = await TempVoice.countDocuments({ guildId: guild.id }).catch(() => 0);

    // Member voice state
    const voiceState = guild.voiceStates.cache.get(member.id);
    const currentVoiceChannel = voiceState?.channel;

    let voiceDetails = '';
    let tempDoc = null;

    if (currentVoiceChannel) {
      tempDoc = await TempVoice.findOne({ channelId: currentVoiceChannel.id }).catch(() => null);
      if (tempDoc) {
        const isOwner = tempDoc.ownerId === member.id;
        voiceDetails =
          `• **Connected Channel:** <#${currentVoiceChannel.id}>\n` +
          `• **Lounge Owner:** ${isOwner ? '👑 **You**' : `<@${tempDoc.ownerId}>`}\n` +
          `• **Privacy Status:** ${tempDoc.isLocked ? '🔒 **Locked**' : '🔓 **Unlocked**'} • ${tempDoc.isHidden ? '👻 **Hidden**' : '👁️ **Visible**'}\n` +
          `• **User Limit:** \`${currentVoiceChannel.userLimit === 0 ? 'Unlimited' : currentVoiceChannel.userLimit}\` • **Active Users:** \`${currentVoiceChannel.members.size}\``;
      } else {
        voiceDetails =
          `• **Connected Channel:** <#${currentVoiceChannel.id}> *(Standard voice channel)*\n` +
          `• **Tip:** Join ${triggerText} to spawn your personal auto-managed room!`;
      }
    } else {
      voiceDetails =
        `• **Status:** *Not currently in a voice channel*\n` +
        `• **How to join:** Connect to ${triggerText} to automatically create and own your private voice lounge!`;
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`🔊 Voice System & Lounges — ${guild.name}`)
      .setDescription(
        'Temporary custom voice lounges with automatic channel creation, smart permissions, and admin voice control tools.\n' +
        'Use the dropdown or quick action buttons below to manage your room!'
      )
      .addFields(
        {
          name: '⚙️ Join-to-Create Voice Setup',
          value:
            `• **System Status:** ${isConfigured ? '🟢 **Active** `[Auto-Creation ON]`' : '🔴 **Not Configured** `[Run Setup]`'}\n` +
            `• **Trigger Channel:** ${triggerText}\n` +
            `• **Lounge Category:** ${categoryText}\n` +
            `• **Active Lounges:** \`${activeLounges} active voice rooms\``
        },
        {
          name: `🎧 Your Voice Status (<@${member.id}>)`,
          value: voiceDetails
        }
      )
      .setFooter({ text: 'AURA Voice Suite • Custom lounges auto-delete when empty' })
      .setTimestamp();

    if (isAdmin) {
      embed.addFields({
        name: '🛡️ Administrator Controls Enabled',
        value: 'You have full access to auto-setup Join-to-Create, perform mass moves, mass disconnects, mass mutes, and voice bounces.'
      });
    }

    return embed;
  },

  /**
   * Build interactive components.
   * Admin actions are strictly omitted if the caller is not an administrator.
   */
  buildHubComponents(member, isAdmin, guildDoc, currentVoiceChannel, tempDoc) {
    const components = [];
    const isOwner = tempDoc && tempDoc.ownerId === member.id;
    const canControlLounge = isOwner || (tempDoc && isAdmin);

    // Row 1: Interactive Dropdown Select Menu
    const selectOptions = [];

    if (canControlLounge) {
      selectOptions.push(
        new StringSelectMenuOptionBuilder()
          .setValue('act_vc_toggle_lock')
          .setLabel(tempDoc.isLocked ? 'Unlock Voice Channel' : 'Lock Voice Channel')
          .setDescription(tempDoc.isLocked ? 'Allow other members to join' : 'Prevent new members from joining')
          .setEmoji(tempDoc.isLocked ? '🔓' : '🔒'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_vc_toggle_hide')
          .setLabel(tempDoc.isHidden ? 'Show Voice Channel' : 'Hide Voice Channel')
          .setDescription(tempDoc.isHidden ? 'Make channel visible to @everyone' : 'Hide channel from @everyone')
          .setEmoji(tempDoc.isHidden ? '👁️' : '👻'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_vc_limit')
          .setLabel('Set User Limit')
          .setDescription('Set max capacity for your voice room (0-99)')
          .setEmoji('👥'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_vc_rename')
          .setLabel('Rename Voice Channel')
          .setDescription('Change the name of your lounge')
          .setEmoji('✏️'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_vc_post_panel')
          .setLabel('Post In-Channel Control Panel')
          .setDescription('Send interactive panel inside your voice channel')
          .setEmoji('🎛️')
      );
    } else {
      selectOptions.push(
        new StringSelectMenuOptionBuilder()
          .setValue('act_vc_refresh')
          .setLabel('Refresh Status')
          .setDescription('Update voice channel state and active lounges')
          .setEmoji('🔄')
      );
    }

    if (isAdmin) {
      selectOptions.push(
        new StringSelectMenuOptionBuilder()
          .setValue('act_vc_setup')
          .setLabel('Auto-Setup Join-to-Create')
          .setDescription('Create category and trigger channel in 1 click')
          .setEmoji('🚀'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_vc_massmove_guide')
          .setLabel('Mass Move Members')
          .setDescription('Move all members from one voice channel to another')
          .setEmoji('🚚'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_vc_massdc_guide')
          .setLabel('Mass Disconnect Members')
          .setDescription('Disconnect all members in a voice channel')
          .setEmoji('🔌'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_vc_massmute_guide')
          .setLabel('Mass Server Mute / Unmute')
          .setDescription('Server mute or unmute all connected members')
          .setEmoji('🔇')
      );
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_vchub_action')
      .setPlaceholder('⚡ Select a voice action or admin tool...')
      .addOptions(selectOptions);

    components.push(new ActionRowBuilder().addComponents(selectMenu));

    // Row 2: Member Quick Action Buttons
    if (canControlLounge) {
      const memberRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_vchub_lock')
          .setLabel(tempDoc.isLocked ? 'Unlock' : 'Lock')
          .setStyle(tempDoc.isLocked ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setEmoji(tempDoc.isLocked ? '🔓' : '🔒'),
        new ButtonBuilder()
          .setCustomId('btn_vchub_hide')
          .setLabel(tempDoc.isHidden ? 'Show' : 'Hide')
          .setStyle(tempDoc.isHidden ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setEmoji(tempDoc.isHidden ? '👁️' : '👻'),
        new ButtonBuilder()
          .setCustomId('btn_vchub_limit')
          .setLabel('Limit')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('👥'),
        new ButtonBuilder()
          .setCustomId('btn_vchub_rename')
          .setLabel('Rename')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('✏️'),
        new ButtonBuilder()
          .setCustomId('btn_vchub_panel')
          .setLabel('Panel')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎛️')
      );
      components.push(memberRow);
    } else {
      const memberRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_vchub_refresh')
          .setLabel('Refresh Status')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔄')
      );
      components.push(memberRow);
    }

    // Row 3: Admin Quick Action Buttons (STRICTLY ADMIN ONLY)
    if (isAdmin) {
      const adminRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_vchub_setup')
          .setLabel('Auto-Setup')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🚀'),
        new ButtonBuilder()
          .setCustomId('btn_vchub_massmove')
          .setLabel('Mass Move')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🚚'),
        new ButtonBuilder()
          .setCustomId('btn_vchub_massdc')
          .setLabel('Mass DC')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔌'),
        new ButtonBuilder()
          .setCustomId('btn_vchub_massmute')
          .setLabel('Mass Mute')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔇')
      );
      components.push(adminRow);
    }

    return components;
  },

  /**
   * Handle button interactions
   */
  async handleButton(interaction, client) {
    const customId = interaction.customId;
    const member = interaction.member || await interaction.guild.members.fetch(interaction.user.id);
    const isAdmin = isOwnerOrAdmin(member, interaction.guild, client);
    const voiceState = interaction.guild.voiceStates.cache.get(member.id);
    const voiceChannel = voiceState?.channel;

    // Refresh button
    if (customId === 'btn_vchub_refresh') {
      const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });
      const tempDoc = voiceChannel ? await TempVoice.findOne({ channelId: voiceChannel.id }) : null;
      const embed = await this.buildHubEmbed(interaction.guild, guildDoc, member, isAdmin);
      const components = this.buildHubComponents(member, isAdmin, guildDoc, voiceChannel, tempDoc);
      return interaction.update({ embeds: [embed], components });
    }

    // Lounge member controls
    if (['btn_vchub_lock', 'btn_vchub_hide', 'btn_vchub_limit', 'btn_vchub_rename', 'btn_vchub_panel'].includes(customId)) {
      if (!voiceChannel) {
        return interaction.reply({ content: '❌ You must be connected to your voice lounge.', ephemeral: true });
      }
      const tempDoc = await TempVoice.findOne({ channelId: voiceChannel.id });
      if (!tempDoc) {
        return interaction.reply({ content: '❌ This channel is not a bot-managed temporary lounge.', ephemeral: true });
      }
      if (tempDoc.ownerId !== member.id && !isAdmin) {
        return interaction.reply({ content: '🚫 Only the lounge owner or an administrator can manage this channel.', ephemeral: true });
      }

      if (customId === 'btn_vchub_lock') {
        const nextLocked = !tempDoc.isLocked;
        await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: !nextLocked });
        tempDoc.isLocked = nextLocked;
        await tempDoc.save();

        const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });
        const embed = await this.buildHubEmbed(interaction.guild, guildDoc, member, isAdmin);
        const components = this.buildHubComponents(member, isAdmin, guildDoc, voiceChannel, tempDoc);
        await interaction.update({ embeds: [embed], components });
        return;
      }

      if (customId === 'btn_vchub_hide') {
        const nextHidden = !tempDoc.isHidden;
        await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: !nextHidden });
        tempDoc.isHidden = nextHidden;
        await tempDoc.save();

        const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });
        const embed = await this.buildHubEmbed(interaction.guild, guildDoc, member, isAdmin);
        const components = this.buildHubComponents(member, isAdmin, guildDoc, voiceChannel, tempDoc);
        await interaction.update({ embeds: [embed], components });
        return;
      }

      if (customId === 'btn_vchub_limit') {
        const modal = new ModalBuilder()
          .setCustomId(`modal_vchub_limit_${voiceChannel.id}`)
          .setTitle('Set Voice Channel Limit');
        const input = new TextInputBuilder()
          .setCustomId('limit_input')
          .setLabel('User Limit (0-99, 0 = unlimited)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. 5 or 0')
          .setRequired(true)
          .setMaxLength(2);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (customId === 'btn_vchub_rename') {
        const modal = new ModalBuilder()
          .setCustomId(`modal_vchub_rename_${voiceChannel.id}`)
          .setTitle('Rename Voice Channel');
        const input = new TextInputBuilder()
          .setCustomId('name_input')
          .setLabel('New Channel Name')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. Chill Lounge 🎧')
          .setRequired(true)
          .setMaxLength(50);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (customId === 'btn_vchub_panel') {
        const panelData = voiceManager.buildControlPanel(voiceChannel, member);
        await voiceChannel.send({
          content: `👋 <@${member.id}>, here is your voice control panel:`,
          embeds: panelData.embeds,
          components: panelData.components
        }).catch(() => {});
        return interaction.reply({ content: `✅ Voice control panel posted into <#${voiceChannel.id}>!`, ephemeral: true });
      }
    }

    // Admin buttons
    if (customId === 'btn_vchub_setup') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });

      const guild = interaction.guild;
      const category = await guild.channels.create({
        name: '🔊 VOICE LOUNGES',
        type: ChannelType.GuildCategory
      });
      const trigger = await guild.channels.create({
        name: '➕ Join to Create',
        type: ChannelType.GuildVoice,
        parent: category.id,
        userLimit: 1
      });

      await guildService.updateSettings(guild.id, {
        'modules.join_to_create': true,
        'joinToCreate.enabled': true,
        'joinToCreate.channelId': trigger.id,
        'joinToCreate.categoryId': category.id,
        'joinToCreate.channelNameFormat': "🔊 {username}'s Lounge"
      });

      const updatedDoc = await Guild.findOne({ guildId: guild.id });
      const embed = await this.buildHubEmbed(guild, updatedDoc, member, true);
      const components = this.buildHubComponents(member, true, updatedDoc, voiceChannel, null);

      return interaction.update({
        embeds: [embed],
        components
      });
    }

    if (customId === 'btn_vchub_massmove') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      return interaction.reply({
        content: '🚚 **Mass Move Quick Guide:**\nUse `/vc move to:<#channel> [from:<#channel>]` or `+vc move <#to> [#from]` to move all members in one command.',
        ephemeral: true
      });
    }

    if (customId === 'btn_vchub_massdc') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      return interaction.reply({
        content: '🔌 **Mass Disconnect Quick Guide:**\nUse `/vc disconnect [channel:<#channel>]` or `+vc disconnect [#channel]` to mass disconnect members.',
        ephemeral: true
      });
    }

    if (customId === 'btn_vchub_massmute') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      return interaction.reply({
        content: '🔇 **Mass Mute / Unmute Quick Guide:**\nUse `/vc mute [channel:<#channel>]` or `/vc unmute [channel:<#channel>]` to instantly server mute/unmute a voice room.',
        ephemeral: true
      });
    }
  },

  /**
   * Handle dropdown select menu interactions
   */
  async handleSelectMenu(interaction, client) {
    const selected = interaction.values[0];
    const member = interaction.member || await interaction.guild.members.fetch(interaction.user.id);
    const isAdmin = isOwnerOrAdmin(member, interaction.guild, client);
    const voiceState = interaction.guild.voiceStates.cache.get(member.id);
    const voiceChannel = voiceState?.channel;

    if (selected === 'act_vc_refresh') {
      const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });
      const tempDoc = voiceChannel ? await TempVoice.findOne({ channelId: voiceChannel.id }) : null;
      const embed = await this.buildHubEmbed(interaction.guild, guildDoc, member, isAdmin);
      const components = this.buildHubComponents(member, isAdmin, guildDoc, voiceChannel, tempDoc);
      return interaction.update({ embeds: [embed], components });
    }

    if (['act_vc_toggle_lock', 'act_vc_toggle_hide', 'act_vc_limit', 'act_vc_rename', 'act_vc_post_panel'].includes(selected)) {
      if (!voiceChannel) {
        return interaction.reply({ content: '❌ You must be connected to your voice lounge.', ephemeral: true });
      }
      const tempDoc = await TempVoice.findOne({ channelId: voiceChannel.id });
      if (!tempDoc) {
        return interaction.reply({ content: '❌ This channel is not a bot-managed temporary lounge.', ephemeral: true });
      }
      if (tempDoc.ownerId !== member.id && !isAdmin) {
        return interaction.reply({ content: '🚫 Only the lounge owner or an administrator can manage this channel.', ephemeral: true });
      }

      if (selected === 'act_vc_toggle_lock') {
        const nextLocked = !tempDoc.isLocked;
        await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: !nextLocked });
        tempDoc.isLocked = nextLocked;
        await tempDoc.save();

        const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });
        const embed = await this.buildHubEmbed(interaction.guild, guildDoc, member, isAdmin);
        const components = this.buildHubComponents(member, isAdmin, guildDoc, voiceChannel, tempDoc);
        return interaction.update({ embeds: [embed], components });
      }

      if (selected === 'act_vc_toggle_hide') {
        const nextHidden = !tempDoc.isHidden;
        await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: !nextHidden });
        tempDoc.isHidden = nextHidden;
        await tempDoc.save();

        const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });
        const embed = await this.buildHubEmbed(interaction.guild, guildDoc, member, isAdmin);
        const components = this.buildHubComponents(member, isAdmin, guildDoc, voiceChannel, tempDoc);
        return interaction.update({ embeds: [embed], components });
      }

      if (selected === 'act_vc_limit') {
        const modal = new ModalBuilder()
          .setCustomId(`modal_vchub_limit_${voiceChannel.id}`)
          .setTitle('Set Voice Channel Limit');
        const input = new TextInputBuilder()
          .setCustomId('limit_input')
          .setLabel('User Limit (0-99, 0 = unlimited)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. 5 or 0')
          .setRequired(true)
          .setMaxLength(2);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (selected === 'act_vc_rename') {
        const modal = new ModalBuilder()
          .setCustomId(`modal_vchub_rename_${voiceChannel.id}`)
          .setTitle('Rename Voice Channel');
        const input = new TextInputBuilder()
          .setCustomId('name_input')
          .setLabel('New Channel Name')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. Chill Lounge 🎧')
          .setRequired(true)
          .setMaxLength(50);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (selected === 'act_vc_post_panel') {
        const panelData = voiceManager.buildControlPanel(voiceChannel, member);
        await voiceChannel.send({
          content: `👋 <@${member.id}>, here is your voice control panel:`,
          embeds: panelData.embeds,
          components: panelData.components
        }).catch(() => {});
        return interaction.reply({ content: `✅ Voice control panel posted into <#${voiceChannel.id}>!`, ephemeral: true });
      }
    }

    if (selected === 'act_vc_setup') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      const guild = interaction.guild;
      const category = await guild.channels.create({
        name: '🔊 VOICE LOUNGES',
        type: ChannelType.GuildCategory
      });
      const trigger = await guild.channels.create({
        name: '➕ Join to Create',
        type: ChannelType.GuildVoice,
        parent: category.id,
        userLimit: 1
      });

      await guildService.updateSettings(guild.id, {
        'modules.join_to_create': true,
        'joinToCreate.enabled': true,
        'joinToCreate.channelId': trigger.id,
        'joinToCreate.categoryId': category.id,
        'joinToCreate.channelNameFormat': "🔊 {username}'s Lounge"
      });

      const updatedDoc = await Guild.findOne({ guildId: guild.id });
      const embed = await this.buildHubEmbed(guild, updatedDoc, member, true);
      const components = this.buildHubComponents(member, true, updatedDoc, voiceChannel, null);

      return interaction.update({ embeds: [embed], components });
    }

    if (selected === 'act_vc_massmove_guide') {
      return interaction.reply({
        content: '🚚 **Mass Move Quick Guide:**\nUse `/vc move to:<#channel> [from:<#channel>]` or `+vc move <#to> [#from]` to move all members in one command.',
        ephemeral: true
      });
    }

    if (selected === 'act_vc_massdc_guide') {
      return interaction.reply({
        content: '🔌 **Mass Disconnect Quick Guide:**\nUse `/vc disconnect [channel:<#channel>]` or `+vc disconnect [#channel]` to mass disconnect members.',
        ephemeral: true
      });
    }

    if (selected === 'act_vc_massmute_guide') {
      return interaction.reply({
        content: '🔇 **Mass Mute / Unmute Quick Guide:**\nUse `/vc mute [channel:<#channel>]` or `/vc unmute [channel:<#channel>]` to instantly server mute/unmute a voice room.',
        ephemeral: true
      });
    }
  },

  /**
   * Handle modals for voice hub (rename, limit)
   */
  async handleModal(interaction, client) {
    const customId = interaction.customId;
    const channelId = customId.split('_')[3];
    const channel = interaction.guild.channels.cache.get(channelId);

    if (!channel) {
      return interaction.reply({ content: '❌ Channel no longer exists.', ephemeral: true });
    }

    if (customId.startsWith('modal_vchub_limit_')) {
      const limitStr = interaction.fields.getTextInputValue('limit_input');
      const limit = parseInt(limitStr, 10);
      if (isNaN(limit) || limit < 0 || limit > 99) {
        return interaction.reply({ content: '❌ Please enter a valid number between 0 and 99.', ephemeral: true });
      }
      await channel.setUserLimit(limit);
      return interaction.reply({ content: `👥 Voice channel user limit set to **${limit === 0 ? 'unlimited' : limit}**!`, ephemeral: true });
    }

    if (customId.startsWith('modal_vchub_rename_')) {
      const name = interaction.fields.getTextInputValue('name_input');
      if (!name || name.trim().length === 0) {
        return interaction.reply({ content: '❌ Please enter a non-empty channel name.', ephemeral: true });
      }
      await channel.setName(name.trim().substring(0, 100));
      return interaction.reply({ content: `✏️ Voice channel renamed to **"${name.trim()}"**!`, ephemeral: true });
    }
  }
};

module.exports = voiceHub;
