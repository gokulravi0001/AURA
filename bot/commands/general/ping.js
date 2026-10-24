const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check AURA bot latency and Discord API response time'),
  name: 'ping',
  description: 'Check AURA bot latency and Discord API response time',
  aliases: ['latency', 'p'],

  async execute(interaction, client) {
    const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsPing = client.ws.ping;

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('🏓 Pong!')
      .addFields(
        { name: 'API Latency', value: `\`${roundtrip}ms\``, inline: true },
        { name: 'WebSocket Ping', value: `\`${wsPing}ms\``, inline: true }
      )
      .setFooter({ text: 'AURA Multipurpose Bot' })
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  },

  async executePrefix(message, args, client) {
    const sent = await message.reply('🏓 Pinging...');
    const roundtrip = sent.createdTimestamp - message.createdTimestamp;
    const wsPing = client.ws.ping;

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('🏓 Pong!')
      .addFields(
        { name: 'API Latency', value: `\`${roundtrip}ms\``, inline: true },
        { name: 'WebSocket Ping', value: `\`${wsPing}ms\``, inline: true }
      )
      .setFooter({ text: 'AURA Multipurpose Bot' })
      .setTimestamp();

    await sent.edit({ content: null, embeds: [embed] });
  }
};
