const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder,
  ChannelType
} = require('discord.js');
const Guild = require('../../models/Guild');
const serverTagService = require('./serverTagService');
const counterService = require('./counterService');
const guildService = require('../../shared/guildService');
const { COLORS } = require('../../shared/constants');
const { isOwnerOrAdmin } = require('../../shared/permissionHelper');

const serverToolsHub = {
  /**
   * Build the complete minimal interactive Server Tools & Growth Hub embed
   */
  async buildHubEmbed(guild, guildDoc, user, isAdmin) {
    const tagCfg = guildDoc?.serverTagRole || {};
    const tagInfo = serverTagService.detectGuildServerTagInfo(guild, tagCfg);
    const tagEnabled = tagCfg.enabled && guildDoc?.modules?.server_tag_role !== false;
    const tagRoleDisplay = tagCfg.roleId ? `<@&${tagCfg.roleId}>` : '`Not configured`';
    const tagWearerCount = tagCfg.roleId && guild.roles?.cache?.has(tagCfg.roleId)
      ? (typeof guild.members?.cache?.filter === 'function' ? guild.members.cache.filter(m => m.roles?.cache?.has(tagCfg.roleId)).size : (tagCfg.activeMemberCount || 0))
      : (tagCfg.activeMemberCount || 0);

    // Voice Counters
    const vcCfg = guildDoc?.voiceCounters || {};
    const vcEnabled = vcCfg.enabled && guildDoc?.modules?.voice_counters !== false;
    const vcCounters = vcCfg.counters || [];
    const vcText = vcCounters.length > 0
      ? vcCounters.map(c => `• <#${c.channelId}> \`[${c.type}]\``).join('\n')
      : '`No voice counter channels setup`';

    // Invites & Guard
    const invCfg = guildDoc?.invites || {};
    const inviteLogChannel = invCfg.channelId ? `<#${invCfg.channelId}>` : '`Not configured`';
    const inviterRole = guildDoc?.inviterRole?.roleId ? `<@&${guildDoc.inviterRole.roleId}>` : '`Disabled (@everyone)`';

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`🛠️ Server Tools & Growth Hub — ${guild.name}`)
      .setDescription(
        'Centralized server management suite: Server Tag Auto-Role, Live Stat Counters, and Invite Protection.\n' +
        'Use the dropdown or quick action buttons below to manage everything!'
      )
      .addFields(
        {
          name: '🏷️ Server Tag Auto-Role',
          value:
            `• **Status:** ${tagEnabled ? '🟢 **Active**' : '🔴 **Disabled**'}\n` +
            `• **Server Tag:** \`${tagInfo?.tag || 'Awaiting Tag'}\`\n` +
            `• **Reward Role:** ${tagRoleDisplay}\n` +
            `• **Current Wearers:** \`${tagWearerCount} members\``
        },
        {
          name: '📊 Live Server Stat Counters',
          value:
            `• **Status:** ${vcEnabled ? '🟢 **Active**' : '🔴 **Not Configured**'}\n` +
            `• **Counter Channels (${vcCounters.length}):**\n${vcText}`
        },
        {
          name: '📨 Invite Tracking & Guard',
          value:
            `• **Invite Logs:** ${inviteLogChannel}\n` +
            `• **Pre-screening Logs:** ${invCfg.preScreeningLogging ? '🟢 **Enabled**' : '🔴 **Disabled**'}\n` +
            `• **Inviter Role Guard:** ${inviterRole}`
        }
      )
      .setFooter({ text: 'AURA Server Tools • Automated community growth' })
      .setTimestamp();

    if (isAdmin) {
      embed.addFields({
        name: '🛡️ Administrator Controls Enabled',
        value: 'You have permission to sync server tag roles, setup voice counters, toggle tools, and configure channels.'
      });
    }

    return embed;
  },

  /**
   * Build interactive components
   */
  buildHubComponents(isAdmin, guildDoc = null) {
    const components = [];

    // Row 1: Interactive Dropdown Menu
    const selectOptions = [
      new StringSelectMenuOptionBuilder()
        .setValue('act_tools_refresh')
        .setLabel('Refresh Server Stats')
        .setDescription('Update tag wearers and server counter numbers')
        .setEmoji('🔄')
    ];

    if (isAdmin) {
      selectOptions.push(
        new StringSelectMenuOptionBuilder()
          .setValue('act_tools_sync_tag')
          .setLabel('Sync Server Tag Roles Now')
          .setDescription('Scan members and grant/remove server tag role')
          .setEmoji('🔄'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_tools_setup_counters')
          .setLabel('Auto-Setup Voice Counters')
          .setDescription('Create category and locked voice stat channels')
          .setEmoji('📊'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_tools_update_counters')
          .setLabel('Force Update Counters')
          .setDescription('Immediately refresh voice channel names')
          .setEmoji('⚡'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_tools_toggle_tag')
          .setLabel('Toggle Server Tag Role')
          .setDescription('Enable or disable server tag auto role assignment')
          .setEmoji('🏷️')
      );
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_tools_action')
      .setPlaceholder('⚡ Select a server tool or administrative action...')
      .addOptions(selectOptions);

    components.push(new ActionRowBuilder().addComponents(selectMenu));

    // Row 2: Quick Action Buttons (Admin only gets actionable rows)
    if (isAdmin) {
      const adminRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_tools_tag_sync')
          .setLabel('Sync Tag Roles')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setCustomId('btn_tools_counters_setup')
          .setLabel('Setup Counters')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📊'),
        new ButtonBuilder()
          .setCustomId('btn_tools_counters_update')
          .setLabel('Update Counters')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⚡'),
        new ButtonBuilder()
          .setCustomId('btn_tools_refresh')
          .setLabel('Refresh')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔄')
      );
      components.push(adminRow);
    } else {
      const memberRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_tools_refresh')
          .setLabel('Refresh Stats')
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

    if (customId === 'btn_tools_refresh') {
      const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });
      const embed = await this.buildHubEmbed(interaction.guild, guildDoc, interaction.user, isAdmin);
      const components = this.buildHubComponents(isAdmin, guildDoc);
      return interaction.update({ embeds: [embed], components });
    }

    if (customId === 'btn_tools_tag_sync') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      const settings = await guildService.getSettings(interaction.guild.id);
      const res = await serverTagService.syncGuildMembers(interaction.guild, settings, { force: true });
      return interaction.followUp({ content: `✅ Server Tag sync complete: Added to **${res.added}**, removed from **${res.removed}** member(s).`, ephemeral: true });
    }

    if (customId === 'btn_tools_counters_setup') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      try {
        const wizardResult = await counterService.setupWizard(interaction.guild);
        await Guild.updateOne(
          { guildId: interaction.guild.id },
          {
            $set: {
              'modules.voice_counters': true,
              'voiceCounters.enabled': true,
              'voiceCounters.categoryId': wizardResult.categoryId,
              'voiceCounters.counters': wizardResult.counters
            }
          },
          { upsert: true }
        );
        return interaction.followUp({ content: `✅ Created **${wizardResult.counters.length}** live voice counter channels!`, ephemeral: true });
      } catch (err) {
        return interaction.followUp({ content: `❌ Setup failed: ${err.message}`, ephemeral: true });
      }
    }

    if (customId === 'btn_tools_counters_update') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      await counterService.updateGuildCounters(interaction.guild, true);
      return interaction.followUp({ content: '⚡ Voice counters updated successfully!', ephemeral: true });
    }
  },

  /**
   * Handle select menu interactions
   */
  async handleSelectMenu(interaction, client) {
    const selected = interaction.values[0];
    const isAdmin = isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client);

    if (selected === 'act_tools_refresh') {
      const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });
      const embed = await this.buildHubEmbed(interaction.guild, guildDoc, interaction.user, isAdmin);
      const components = this.buildHubComponents(isAdmin, guildDoc);
      return interaction.update({ embeds: [embed], components });
    }

    if (selected === 'act_tools_sync_tag') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      const settings = await guildService.getSettings(interaction.guild.id);
      const res = await serverTagService.syncGuildMembers(interaction.guild, settings, { force: true });
      return interaction.followUp({ content: `✅ Server Tag sync complete: Added to **${res.added}**, removed from **${res.removed}** member(s).`, ephemeral: true });
    }

    if (selected === 'act_tools_setup_counters') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      try {
        const wizardResult = await counterService.setupWizard(interaction.guild);
        await Guild.updateOne(
          { guildId: interaction.guild.id },
          {
            $set: {
              'modules.voice_counters': true,
              'voiceCounters.enabled': true,
              'voiceCounters.categoryId': wizardResult.categoryId,
              'voiceCounters.counters': wizardResult.counters
            }
          },
          { upsert: true }
        );
        return interaction.followUp({ content: `✅ Created **${wizardResult.counters.length}** live voice counter channels!`, ephemeral: true });
      } catch (err) {
        return interaction.followUp({ content: `❌ Setup failed: ${err.message}`, ephemeral: true });
      }
    }

    if (selected === 'act_tools_update_counters') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      await counterService.updateGuildCounters(interaction.guild, true);
      return interaction.followUp({ content: '⚡ Voice counters updated successfully!', ephemeral: true });
    }

    if (selected === 'act_tools_toggle_tag') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });
      const current = guildDoc?.serverTagRole?.enabled !== false;
      const next = !current;
      await Guild.updateOne(
        { guildId: interaction.guild.id },
        { $set: { 'serverTagRole.enabled': next, 'modules.server_tag_role': next } },
        { upsert: true }
      );
      const updatedDoc = await Guild.findOne({ guildId: interaction.guild.id });
      const embed = await this.buildHubEmbed(interaction.guild, updatedDoc, interaction.user, true);
      const components = this.buildHubComponents(true, updatedDoc);
      return interaction.update({ embeds: [embed], components });
    }
  }
};

module.exports = serverToolsHub;
