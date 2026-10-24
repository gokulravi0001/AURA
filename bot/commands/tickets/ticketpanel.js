const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const ticketManager = require('../../modules/ticketManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Create and post a support ticket panel with buttons (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel where the panel will be posted')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption(opt => opt.setName('title').setDescription('Panel title').setRequired(false))
    .addStringOption(opt => opt.setName('description').setDescription('Panel description').setRequired(false)),
  name: 'ticket-panel',
  description: 'Create a support ticket panel',
  permissions: [PermissionFlagsBits.Administrator],
  module: 'tickets',

  async execute(interaction, client) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const title = interaction.options.getString('title') || '🎫 Support & Help Desk';
    const description = interaction.options.getString('description') || 'Need help or want to speak with staff? Click the button below to open a private ticket.';

    await ticketManager.createPanel(channel, title, description);
    return interaction.reply({ content: `✅ Ticket panel successfully posted in <#${channel.id}>!`, ephemeral: true });
  },

  async executePrefix(message, args, client) {
    const channel = message.mentions.channels.first() || message.channel;
    await ticketManager.createPanel(channel, '🎫 Support & Help Desk', 'Click the button below to open a private ticket with our team.');
    return message.reply(`✅ Ticket panel created in <#${channel.id}>!`);
  }
};
