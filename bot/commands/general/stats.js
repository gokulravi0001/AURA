const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Display detailed server and bot analytics'),
  name: 'stats',
  description: 'Display detailed server and bot analytics',
  aliases: ['serverstats', 'botstats', 'info'],

  async execute(interaction, client) {
    const embed = await buildStatsEmbed(interaction.guild, client);
    return interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message, args, client) {
    const embed = await buildStatsEmbed(message.guild, client);
    return message.reply({ embeds: [embed] });
  }
};

async function buildStatsEmbed(guild, client) {
  const totalMembers = guild.memberCount || 0;
  const botMembers = guild.members.cache.filter(m => m.user.bot).size;
  const humanMembers = Math.max(0, totalMembers - botMembers);

  let activeInVoice = 0;
  guild.channels.cache.forEach(c => {
    if (c.isVoiceBased()) activeInVoice += c.members.filter(m => !m.user.bot).size;
  });

  const uptimeHours = Math.floor(process.uptime() / 3600);
  const uptimeMinutes = Math.floor((process.uptime() % 3600) / 60);
  const memUsageMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`📈 Analytics for ${guild.name}`)
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .addFields(
      { name: '👥 Total Members', value: `\`${totalMembers.toLocaleString()}\``, inline: true },
      { name: '👤 Humans', value: `\`${humanMembers.toLocaleString()}\``, inline: true },
      { name: '🤖 Bots', value: `\`${botMembers.toLocaleString()}\``, inline: true },
      { name: '🎙️ Active in Voice', value: `\`${activeInVoice}\``, inline: true },
      { name: '🌐 Server Guilds (Global)', value: `\`${client.guilds.cache.size}\``, inline: true },
      { name: '💾 Memory Usage', value: `\`${memUsageMb} MB\``, inline: true },
      { name: '⏱️ Bot Uptime', value: `\`${uptimeHours}h ${uptimeMinutes}m\``, inline: true },
      { name: '📅 Server Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
    )
    .setFooter({ text: 'AURA Server Analytics' })
    .setTimestamp();
}
