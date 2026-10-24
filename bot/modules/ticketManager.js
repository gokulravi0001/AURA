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
const Ticket = require('../../models/Ticket');
const Guild = require('../../models/Guild');
const logger = require('../../shared/logger');
const { COLORS } = require('../../shared/constants');

const ticketManager = {
  /**
   * Post a ticket creation panel into a channel
   */
  async createPanel(channel, title, description, buttonLabel = 'Create Ticket') {
    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(title || '🎫 Support & Help Desk')
      .setDescription(description || 'Click the button below to open a private support ticket with our team.')
      .setFooter({ text: 'AURA Ticket System' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_create')
        .setLabel(buttonLabel)
        .setEmoji('📩')
        .setStyle(ButtonStyle.Primary)
    );

    return await channel.send({ embeds: [embed], components: [row] });
  },

  /**
   * Handle Button clicks: create, claim, close, reopen, delete
   */
  async handleButton(interaction, client) {
    const { customId, guild, user, member, channel } = interaction;

    // 1. OPEN TICKET
    if (customId === 'ticket_create') {
      const modal = new ModalBuilder()
        .setCustomId('modal_ticket_open')
        .setTitle('Open a Support Ticket');

      const subjectInput = new TextInputBuilder()
        .setCustomId('ticket_subject')
        .setLabel('Subject / Reason for Ticket')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., Billing issue, report, general question')
        .setRequired(true)
        .setMaxLength(100);

      modal.addComponents(new ActionRowBuilder().addComponents(subjectInput));
      return await interaction.showModal(modal);
    }

    // Existing ticket actions require a valid database ticket
    const ticket = await Ticket.findOne({ channelId: channel.id });
    if (!ticket) {
      return interaction.reply({ content: '⚠️ This channel is not an active ticket.', ephemeral: true });
    }

    // 2. CLAIM TICKET
    if (customId === 'ticket_claim') {
      if (ticket.claimedBy) {
        return interaction.reply({ content: `⚠️ This ticket is already claimed by <@${ticket.claimedBy}>.`, ephemeral: true });
      }

      ticket.claimedBy = user.id;
      ticket.claimedByName = user.username;
      ticket.status = 'claimed';
      await ticket.save();

      const claimEmbed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setDescription(`🤝 Ticket claimed by <@${user.id}>. They will assist you shortly.`);

      await channel.send({ embeds: [claimEmbed] });
      return interaction.reply({ content: '✅ You have claimed this ticket.', ephemeral: true });
    }

    // 3. CLOSE TICKET
    if (customId === 'ticket_close') {
      if (ticket.status === 'closed') {
        return interaction.reply({ content: '⚠️ This ticket is already closed.', ephemeral: true });
      }

      await interaction.deferReply();

      // Collect transcript of the last 100 messages
      const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
      if (messages) {
        ticket.transcript = messages.reverse().map(m => ({
          author: m.author.username,
          authorId: m.author.id,
          isBot: m.author.bot,
          content: m.cleanContent || '',
          attachments: m.attachments.map(a => a.url),
          timestamp: m.createdAt
        }));
      }

      ticket.status = 'closed';
      ticket.closedAt = new Date();
      ticket.closedBy = user.id;
      ticket.closedByName = user.username;
      await ticket.save();

      // Update channel permissions (remove user's send permission)
      await channel.permissionOverwrites.edit(ticket.userId, {
        SendMessages: false,
        ViewChannel: true
      }).catch(() => {});

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_reopen').setLabel('Reopen Ticket').setStyle(ButtonStyle.Secondary).setEmoji('🔓'),
        new ButtonBuilder().setCustomId('ticket_delete').setLabel('Delete Channel').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
      );

      const closeEmbed = new EmbedBuilder()
        .setColor(COLORS.WARNING)
        .setTitle('🔒 Ticket Closed')
        .setDescription(`This ticket was closed by <@${user.id}>.\nTranscript has been saved to the dashboard database.`);

      return await interaction.followUp({ embeds: [closeEmbed], components: [closeRow] });
    }

    // 4. REOPEN TICKET
    if (customId === 'ticket_reopen') {
      ticket.status = 'open';
      ticket.closedAt = null;
      ticket.closedBy = null;
      await ticket.save();

      await channel.permissionOverwrites.edit(ticket.userId, {
        SendMessages: true,
        ViewChannel: true
      }).catch(() => {});

      return interaction.reply({ content: `🔓 Ticket reopened by <@${user.id}>.` });
    }

    // 5. DELETE TICKET
    if (customId === 'ticket_delete') {
      await interaction.reply({ content: '🗑️ Deleting ticket channel in 5 seconds...' });
      setTimeout(async () => {
        await channel.delete('Ticket deleted by staff').catch(() => {});
      }, 5000);
    }
  },

  /**
   * Handle Ticket open modal
   */
  async handleModal(interaction, client) {
    const { guild, user } = interaction;
    const subject = interaction.fields.getTextInputValue('ticket_subject') || 'General Support';

    await interaction.deferReply({ ephemeral: true });

    try {
      const guildDoc = await Guild.findOneAndUpdate(
        { guildId: guild.id },
        { $inc: { 'tickets.ticketCounter': 1 } },
        { new: true, upsert: true }
      );

      const ticketNum = guildDoc.tickets.ticketCounter || 1;
      const channelName = `ticket-${String(ticketNum).padStart(4, '0')}`;

      // Overwrites: @everyone denies view, ticket author allows view & send, bot allows all
      const permissionOverwrites = [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.AttachFiles,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        },
        {
          id: client.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.EmbedLinks
          ]
        }
      ];

      // Staff role overwrite if configured
      if (guildDoc.tickets.staffRoleId) {
        permissionOverwrites.push({
          id: guildDoc.tickets.staffRoleId,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageMessages
          ]
        });
      }

      const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: guildDoc.tickets.categoryId || undefined,
        permissionOverwrites
      });

      // Save ticket in database
      const ticketDoc = await Ticket.create({
        guildId: guild.id,
        channelId: ticketChannel.id,
        ticketNumber: ticketNum,
        userId: user.id,
        username: user.username,
        subject,
        status: 'open'
      });

      // Welcome embed in ticket channel
      const controlRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim Ticket').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️'),
        new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
      );

      const welcomeEmbed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`🎫 Ticket #${ticketNum} - ${subject}`)
        .setDescription(`Hello <@${user.id}>, welcome to your private ticket channel!\nStaff will be with you shortly. Please explain your inquiry in detail.`)
        .addFields(
          { name: 'Created By', value: `<@${user.id}>`, inline: true },
          { name: 'Subject', value: subject, inline: true }
        )
        .setTimestamp();

      await ticketChannel.send({ content: `<@${user.id}>`, embeds: [welcomeEmbed], components: [controlRow] });

      return interaction.followUp({
        content: `✅ Your ticket has been created: <#${ticketChannel.id}>`,
        ephemeral: true
      });
    } catch (err) {
      logger.error('Error creating ticket channel:', err);
      return interaction.followUp({
        content: `❌ Failed to create ticket channel: ${err.message}`,
        ephemeral: true
      });
    }
  }
};

module.exports = ticketManager;
