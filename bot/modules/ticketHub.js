const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const Ticket = require('../../models/Ticket');
const Guild = require('../../models/Guild');
const ticketManager = require('./ticketManager');
const { COLORS } = require('../../shared/constants');
const { isOwnerOrAdmin } = require('../../shared/permissionHelper');

const ticketHub = {
  /**
   * Build the complete minimal interactive Ticket Hub embed
   */
  async buildHubEmbed(guild, guildDoc, user, isAdmin, currentChannel = null) {
    const tConfig = guildDoc?.tickets || {};
    const isEnabled = tConfig.enabled !== false;
    const categoryText = tConfig.categoryId ? `<#${tConfig.categoryId}>` : '`Server Root (No Category)`';
    const staffRoleText = tConfig.staffRoleId ? `<@&${tConfig.staffRoleId}>` : '`Administrators Only`';

    const totalTickets = await Ticket.countDocuments({ guildId: guild.id }).catch(() => 0);
    const activeTickets = await Ticket.countDocuments({ guildId: guild.id, status: { $in: ['open', 'claimed'] } }).catch(() => 0);

    // Caller's active tickets
    const userActiveTickets = await Ticket.find({
      guildId: guild.id,
      userId: user.id,
      status: { $in: ['open', 'claimed'] }
    }).limit(5).catch(() => []);

    let userSection = '';
    if (userActiveTickets.length > 0) {
      userSection = userActiveTickets
        .map(t => `• <#${t.channelId}> — \`${t.subject || 'Support'}\` (${t.status === 'claimed' ? `Claimed by <@${t.claimedBy}>` : '⏳ Awaiting Staff'})`)
        .join('\n');
    } else {
      userSection = '*You have no active open tickets.* Click **[📩 Open Ticket]** below to get help!';
    }

    // Check if current channel is a ticket
    let currentTicketText = null;
    if (currentChannel) {
      const currentTicket = await Ticket.findOne({ channelId: currentChannel.id }).catch(() => null);
      if (currentTicket) {
        currentTicketText =
          `• **Ticket ID:** \`#${currentTicket.ticketNumber || currentTicket.channelId.slice(-4)}\`\n` +
          `• **Creator:** <@${currentTicket.userId}>\n` +
          `• **Subject:** \`${currentTicket.subject || 'Support'}\`\n` +
          `• **Status:** ${currentTicket.status === 'claimed' ? `🤝 **Claimed by <@${currentTicket.claimedBy}>**` : '⏳ **Unclaimed (Open)**'}`;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`🎫 Support & Ticket System — ${guild.name}`)
      .setDescription(
        'Private 1-on-1 support tickets between members and server staff.\n' +
        'Use the dropdown or quick action buttons below to manage tickets!'
      )
      .addFields(
        {
          name: '⚙️ Server Ticket Setup',
          value:
            `• **System Status:** ${isEnabled ? '🟢 **Active** `[Tickets ON]`' : '🔴 **Disabled** `[Tickets Paused]`'}\n` +
            `• **Category:** ${categoryText}\n` +
            `• **Staff Role:** ${staffRoleText}\n` +
            `• **Stats:** \`${totalTickets} total created\` • \`${activeTickets} currently open\``
        },
        {
          name: `👤 Your Open Tickets (<@${user.id}>)`,
          value: userSection
        }
      )
      .setFooter({ text: 'AURA Ticket Suite • Private support channels' })
      .setTimestamp();

    if (currentTicketText) {
      embed.addFields({
        name: `📍 Current Ticket Channel (<#${currentChannel.id}>)`,
        value: currentTicketText
      });
    }

    if (isAdmin) {
      embed.addFields({
        name: '🛡️ Administrator Controls Enabled',
        value: 'You can deploy public ticket panels, configure category and staff role, or toggle the ticket system.'
      });
    }

    return embed;
  },

  /**
   * Build interactive components
   */
  buildHubComponents(user, isAdmin, guildDoc, currentTicket = null) {
    const isEnabled = guildDoc?.tickets?.enabled !== false;
    const components = [];

    // Row 1: Interactive Dropdown Select Menu
    const selectOptions = [
      new StringSelectMenuOptionBuilder()
        .setValue('act_ticket_open')
        .setLabel('Open Support Ticket')
        .setDescription('Create a private support ticket with staff')
        .setEmoji('📩'),
      new StringSelectMenuOptionBuilder()
        .setValue('act_ticket_mytickets')
        .setLabel('View My Tickets')
        .setDescription('List all your active open tickets')
        .setEmoji('📋')
    ];

    if (currentTicket && ['open', 'claimed'].includes(currentTicket.status)) {
      selectOptions.push(
        new StringSelectMenuOptionBuilder()
          .setValue('act_ticket_claim')
          .setLabel('Claim This Ticket')
          .setDescription('Assign this ticket to yourself')
          .setEmoji('🤝'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_ticket_close')
          .setLabel('Close This Ticket')
          .setDescription('Save transcript and close ticket channel')
          .setEmoji('🔒')
      );
    }

    if (isAdmin) {
      selectOptions.push(
        new StringSelectMenuOptionBuilder()
          .setValue('act_ticket_deploy')
          .setLabel('Deploy Ticket Panel')
          .setDescription('Post interactive creation panel to a channel')
          .setEmoji('📢'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_ticket_setcat')
          .setLabel('Set Ticket Category')
          .setDescription('Parent category where tickets are created')
          .setEmoji('📁'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_ticket_toggle')
          .setLabel(isEnabled ? 'Disable Ticket System' : 'Enable Ticket System')
          .setDescription(isEnabled ? 'Pause new ticket creation' : 'Resume ticket creation')
          .setEmoji(isEnabled ? '🔴' : '🟢')
      );
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_tickethub_action')
      .setPlaceholder('⚡ Select an action (Open ticket, Deploy panel, Setup)...')
      .addOptions(selectOptions);

    components.push(new ActionRowBuilder().addComponents(selectMenu));

    // Row 2: Member Quick Action Buttons
    const memberRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_tickethub_open')
        .setLabel('Open Ticket')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📩'),
      new ButtonBuilder()
        .setCustomId('btn_tickethub_mytickets')
        .setLabel('My Tickets')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📋')
    );

    if (currentTicket && ['open', 'claimed'].includes(currentTicket.status)) {
      memberRow.addComponents(
        new ButtonBuilder()
          .setCustomId('btn_tickethub_claim')
          .setLabel('Claim')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🤝'),
        new ButtonBuilder()
          .setCustomId('btn_tickethub_close')
          .setLabel('Close')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      );
    }

    components.push(memberRow);

    // Row 3: Admin Quick Action Buttons (STRICTLY ADMIN ONLY)
    if (isAdmin) {
      const adminRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_tickethub_deploy')
          .setLabel('Deploy Panel')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📢'),
        new ButtonBuilder()
          .setCustomId('btn_tickethub_setcat')
          .setLabel('Set Category')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📁'),
        new ButtonBuilder()
          .setCustomId('btn_tickethub_toggle')
          .setLabel(isEnabled ? 'Disable' : 'Enable')
          .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
          .setEmoji(isEnabled ? '🔴' : '🟢')
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
    const isAdmin = isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client);

    if (customId === 'btn_tickethub_open') {
      return await this.showOpenTicketModal(interaction);
    }

    if (customId === 'btn_tickethub_mytickets') {
      const tickets = await Ticket.find({
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        status: { $in: ['open', 'claimed'] }
      });
      if (!tickets.length) {
        return interaction.reply({ content: 'ℹ️ You have no active open tickets on this server.', ephemeral: true });
      }
      const list = tickets.map(t => `• <#${t.channelId}> — \`${t.subject || 'Support'}\` (${t.status})`).join('\n');
      return interaction.reply({
        content: `📋 **Your Active Support Tickets:**\n${list}`,
        ephemeral: true
      });
    }

    if (customId === 'btn_tickethub_claim') {
      interaction.customId = 'ticket_claim';
      return await ticketManager.handleButton(interaction, client);
    }

    if (customId === 'btn_tickethub_close') {
      interaction.customId = 'ticket_close';
      return await ticketManager.handleButton(interaction, client);
    }

    // Admin buttons
    if (customId === 'btn_tickethub_deploy') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('select_tickethub_deploy_channel')
        .setPlaceholder('📢 Select channel to deploy the Ticket Panel...')
        .setChannelTypes(ChannelType.GuildText);
      const row = new ActionRowBuilder().addComponents(channelSelect);
      return interaction.reply({
        content: '📢 **Select the channel where the public Ticket Panel will be posted:**',
        components: [row],
        ephemeral: true
      });
    }

    if (customId === 'btn_tickethub_setcat') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('select_tickethub_category')
        .setPlaceholder('📁 Select the Category for new tickets...')
        .setChannelTypes(ChannelType.GuildCategory);
      const row = new ActionRowBuilder().addComponents(channelSelect);
      return interaction.reply({
        content: '📁 **Select the category where newly opened tickets will appear:**',
        components: [row],
        ephemeral: true
      });
    }

    if (customId === 'btn_tickethub_toggle') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      const doc = await Guild.findOne({ guildId: interaction.guild.id });
      const current = doc?.tickets?.enabled !== false;
      const next = !current;
      await Guild.updateOne(
        { guildId: interaction.guild.id },
        { $set: { 'tickets.enabled': next, 'modules.tickets': next } },
        { upsert: true }
      );
      const updatedDoc = await Guild.findOne({ guildId: interaction.guild.id });
      const currentTicket = await Ticket.findOne({ channelId: interaction.channel.id }).catch(() => null);
      const embed = await this.buildHubEmbed(interaction.guild, updatedDoc, interaction.user, true, interaction.channel);
      const components = this.buildHubComponents(interaction.user, true, updatedDoc, currentTicket);
      return interaction.update({ embeds: [embed], components });
    }
  },

  /**
   * Handle dropdown select menu interactions
   */
  async handleSelectMenu(interaction, client) {
    const selected = interaction.values[0];
    const isAdmin = isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client);

    if (selected === 'act_ticket_open') {
      return await this.showOpenTicketModal(interaction);
    }

    if (selected === 'act_ticket_mytickets') {
      const tickets = await Ticket.find({
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        status: { $in: ['open', 'claimed'] }
      });
      if (!tickets.length) {
        return interaction.reply({ content: 'ℹ️ You have no active open tickets on this server.', ephemeral: true });
      }
      const list = tickets.map(t => `• <#${t.channelId}> — \`${t.subject || 'Support'}\` (${t.status})`).join('\n');
      return interaction.reply({
        content: `📋 **Your Active Support Tickets:**\n${list}`,
        ephemeral: true
      });
    }

    if (selected === 'act_ticket_claim') {
      interaction.customId = 'ticket_claim';
      return await ticketManager.handleButton(interaction, client);
    }

    if (selected === 'act_ticket_close') {
      interaction.customId = 'ticket_close';
      return await ticketManager.handleButton(interaction, client);
    }

    if (selected === 'act_ticket_deploy') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('select_tickethub_deploy_channel')
        .setPlaceholder('📢 Select channel to deploy the Ticket Panel...')
        .setChannelTypes(ChannelType.GuildText);
      const row = new ActionRowBuilder().addComponents(channelSelect);
      return interaction.reply({
        content: '📢 **Select the channel where the public Ticket Panel will be posted:**',
        components: [row],
        ephemeral: true
      });
    }

    if (selected === 'act_ticket_setcat') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('select_tickethub_category')
        .setPlaceholder('📁 Select the Category for new tickets...')
        .setChannelTypes(ChannelType.GuildCategory);
      const row = new ActionRowBuilder().addComponents(channelSelect);
      return interaction.reply({
        content: '📁 **Select the category where newly opened tickets will appear:**',
        components: [row],
        ephemeral: true
      });
    }

    if (selected === 'act_ticket_toggle') {
      if (!isAdmin) return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      const doc = await Guild.findOne({ guildId: interaction.guild.id });
      const current = doc?.tickets?.enabled !== false;
      const next = !current;
      await Guild.updateOne(
        { guildId: interaction.guild.id },
        { $set: { 'tickets.enabled': next, 'modules.tickets': next } },
        { upsert: true }
      );
      const updatedDoc = await Guild.findOne({ guildId: interaction.guild.id });
      const currentTicket = await Ticket.findOne({ channelId: interaction.channel.id }).catch(() => null);
      const embed = await this.buildHubEmbed(interaction.guild, updatedDoc, interaction.user, true, interaction.channel);
      const components = this.buildHubComponents(interaction.user, true, updatedDoc, currentTicket);
      return interaction.update({ embeds: [embed], components });
    }
  },

  /**
   * Handle channel select menus
   */
  async handleChannelSelect(interaction, client) {
    if (!isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client)) {
      return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
    }

    const channelId = interaction.values[0];

    if (interaction.customId === 'select_tickethub_deploy_channel') {
      const channel = interaction.guild.channels.cache.get(channelId);
      if (!channel) return interaction.reply({ content: '❌ Selected channel not found.', ephemeral: true });

      await ticketManager.createPanel(channel, '🎫 Support & Help Desk', 'Click the button below to open a private support ticket with our team.');
      return interaction.reply({ content: `✅ Ticket panel successfully deployed into <#${channelId}>!`, ephemeral: true });
    }

    if (interaction.customId === 'select_tickethub_category') {
      await Guild.updateOne(
        { guildId: interaction.guild.id },
        {
          $set: {
            'modules.tickets': true,
            'tickets.enabled': true,
            'tickets.categoryId': channelId
          }
        },
        { upsert: true }
      );
      return interaction.reply({ content: `📁 Support ticket category set to <#${channelId}>!`, ephemeral: true });
    }
  },

  /**
   * Show ticket opening modal
   */
  async showOpenTicketModal(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('modal_ticket_open')
      .setTitle('Open a Support Ticket');

    const subjectInput = new TextInputBuilder()
      .setCustomId('ticket_subject')
      .setLabel('Subject / Reason for Ticket')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., Billing question, report, general inquiry')
      .setRequired(true)
      .setMaxLength(100);

    modal.addComponents(new ActionRowBuilder().addComponents(subjectInput));
    return await interaction.showModal(modal);
  }
};

module.exports = ticketHub;
