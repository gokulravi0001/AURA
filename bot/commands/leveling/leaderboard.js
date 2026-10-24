const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const UserXP = require('../../../models/UserXP');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('View the top 10 ranked members on this server'),
  name: 'top',
  description: 'View the top 10 ranked members on this server',
  aliases: ['lb', 'leaderboard', 'levels'],
  module: 'leveling',

  async execute(interaction, client) {
    const embed = await buildLeaderboardEmbed(interaction.guild, client);
    return interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message, args, client) {
    const embed = await buildLeaderboardEmbed(message.guild, client);
    return message.reply({ embeds: [embed] });
  }
};

async function buildLeaderboardEmbed(guild, client) {
  const topUsers = await UserXP.find({ guildId: guild.id })
    .sort({ level: -1, xp: -1 })
    .limit(10);

  if (!topUsers.length) {
    return new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`🏆 ${guild.name} Level Leaderboard`)
      .setDescription('No members have earned XP yet. Start chatting to gain XP!');
  }

  const medals = ['🥇', '🥈', '🥉'];
  let description = '';

  for (let i = 0; i < topUsers.length; i++) {
    const record = topUsers[i];
    const medal = medals[i] || `\`#${i + 1}\``;
    description += `${medal} <@${record.userId}> • **Level ${record.level}** (${record.xp.toLocaleString()} XP)\n`;
  }

  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`🏆 ${guild.name} Top Members`)
    .setDescription(description)
    .setFooter({ text: 'Top 10 Leaderboard • Chat to rise up the ranks!' })
    .setTimestamp();
}
