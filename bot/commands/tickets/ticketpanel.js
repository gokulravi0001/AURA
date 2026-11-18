const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder
} = require('discord.js');
const ticketManager = require('../../modules/ticketManager');
const Ticket = require('../../../models/Ticket');
const Guild = require('../../../models/Guild');
const ticketHub = require('../../modules/ticketHub');
const { COLORS } = require('../../../shared/constants');
const { isOwnerOrAdmin } = require('../../../shared/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Interactive Support & Ticket Hub (Panels, Tickets, Manager, Setup)'),
  name: 'ticket',
  description: 'Manage support tickets',
  aliases: ['ticket-panel', 'ticketpanel', 'close', 'claim'],
  module: 'tickets',

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand(false);

    // Default: HUB
    if (!sub || sub === 'hub') {
      const isAdmin = isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client);
      const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });
      const currentTicket = await Ticket.findOne({ channelId: interaction.channel.id }).catch(() => null);
      const embed = await ticketHub.buildHubEmbed(interaction.guild, guildDoc, interaction.user, isAdmin, interaction.channel);
      const components = ticketHub.buildHubComponents(interaction.user, isAdmin, guildDoc, currentTicket);
      return interaction.reply({ embeds: [embed], components, ephemeral: true });
    }

    // 1. PANEL
    if (sub === 'panel') {
      if (!isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client)) {
        return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      }

      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const title = interaction.options.getString('title') || '🎫 Support & Help Desk';
      const description = interaction.options.getString('description') || 'Need help or want to speak with staff? Click the button below to open a private ticket.';

      await ticketManager.createPanel(channel, title, description);
      return interaction.reply({ content: `✅ Ticket panel posted in <#${channel.id}>!`, ephemeral: true });
    }

    // 2. SETUP
    if (sub === 'setup') {
      if (!isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client)) {
        return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      }

      const category = interaction.options.getChannel('category');
      const staffRole = interaction.options.getRole('staff_role');

      await Guild.updateOne(
        { guildId: interaction.guild.id },
        {
          $set: {
            'modules.tickets': true,
            'tickets.enabled': true,
            'tickets.categoryId': category.id,
            'tickets.staffRoleId': staffRole ? staffRole.id : null
          }
        },
        { upsert: true }
      );

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('⚙️ Ticket System Configured')
            .setDescription(`New tickets will open in category **${category.name}**.\n${staffRole ? `Staff Role: <@&${staffRole.id}>` : 'No staff role assigned.'}`)
        ]
      });
    }

    // 3. CLOSE
    if (sub === 'close') {
      // Simulate button click
      interaction.customId = 'ticket_close';
      return await ticketManager.handleButton(interaction, client);
    }

    // 4. CLAIM
    if (sub === 'claim') {
      interaction.customId = 'ticket_claim';
      return await ticketManager.handleButton(interaction, client);
    }

    // 5. ADD USER
    if (sub === 'add') {
      const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
      if (!ticket) return interaction.reply({ content: '⚠️ This channel is not an active support ticket.', ephemeral: true });

      const target = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.edit(target.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });
      return interaction.reply(`✅ Added <@${target.id}> to this ticket.`);
    }

    // 6. REMOVE USER
    if (sub === 'remove') {
      const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
      if (!ticket) return interaction.reply({ content: '⚠️ This channel is not an active support ticket.', ephemeral: true });

      const target = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.delete(target.id);
      return interaction.reply(`🗑️ Removed <@${target.id}> from this ticket.`);
    }
  },

  async executePrefix(message, args, client) {
    const action = args[0]?.toLowerCase();

    // +ticket (no args) or +ticket hub
    if (!action || action === 'hub' || action === 'menu') {
      const isAdmin = isOwnerOrAdmin(message.member || message.author, message.guild, client);
      const guildDoc = await Guild.findOne({ guildId: message.guild.id });
      const currentTicket = await Ticket.findOne({ channelId: message.channel.id }).catch(() => null);
      const embed = await ticketHub.buildHubEmbed(message.guild, guildDoc, message.author, isAdmin, message.channel);
      const components = ticketHub.buildHubComponents(message.author, isAdmin, guildDoc, currentTicket);
      return message.reply({ embeds: [embed], components });
    }

    // +close or +ticket close
    if (action === 'close' || message.content.startsWith('+close')) {
      const ticket = await Ticket.findOne({ channelId: message.channel.id });
      if (!ticket) return message.reply('⚠️ This channel is not an active ticket.');

      const fakeInteraction = {
        customId: 'ticket_close',
        guild: message.guild,
        user: message.author,
        member: message.member,
        channel: message.channel,
        deferReply: async () => {},
        followUp: async (payload) => message.channel.send(payload),
        reply: async (payload) => message.reply(payload)
      };
      return await ticketManager.handleButton(fakeInteraction, client);
    }

    // +claim or +ticket claim
    if (action === 'claim' || message.content.startsWith('+claim')) {
      const ticket = await Ticket.findOne({ channelId: message.channel.id });
      if (!ticket) return message.reply('⚠️ This channel is not an active ticket.');

      const fakeInteraction = {
        customId: 'ticket_claim',
        guild: message.guild,
        user: message.author,
        member: message.member,
        channel: message.channel,
        reply: async (payload) => message.reply(payload)
      };
      return await ticketManager.handleButton(fakeInteraction, client);
    }

    // Default: panel creation
    const channel = message.mentions.channels.first() || message.channel;
    await ticketManager.createPanel(channel, '🎫 Support & Help Desk', 'Click the button below to open a private support ticket with our team.');
    return message.reply(`✅ Ticket panel created in <#${channel.id}>!`);
  }
};
