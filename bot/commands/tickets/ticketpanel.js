const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder
} = require('discord.js');
const ticketManager = require('../../modules/ticketManager');
const Ticket = require('../../../models/Ticket');
const Guild = require('../../../models/Guild');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Create ticket panels, manage support tickets, or configure settings')
    .addSubcommand(sub =>
      sub.setName('panel')
        .setDescription('Create and post a support ticket panel with interactive button (Admin only)')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel where the panel will be posted (defaults to current)')
            .addChannelTypes(ChannelType.GuildText)
        )
        .addStringOption(opt => opt.setName('title').setDescription('Panel title'))
        .addStringOption(opt => opt.setName('description').setDescription('Panel description'))
    )
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Configure ticket category and support staff role (Admin only)')
        .addChannelOption(opt =>
          opt.setName('category')
            .setDescription('Parent category where new tickets are created')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
        .addRoleOption(opt => opt.setName('staff_role').setDescription('Role for support staff members'))
    )
    .addSubcommand(sub =>
      sub.setName('close')
        .setDescription('Close and archive the current support ticket')
    )
    .addSubcommand(sub =>
      sub.setName('claim')
        .setDescription('Claim the current support ticket')
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a user to this ticket channel')
        .addUserOption(opt => opt.setName('user').setDescription('User to add').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a user from this ticket channel')
        .addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(true))
    ),
  name: 'ticket',
  description: 'Manage support tickets',
  aliases: ['ticket-panel', 'ticketpanel', 'close', 'claim'],
  module: 'tickets',

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    // 1. PANEL
    if (sub === 'panel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
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
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
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
