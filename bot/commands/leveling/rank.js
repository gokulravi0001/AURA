const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const UserXP = require('../../../models/UserXP');
const levelingService = require('../../modules/levelingService');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Check your or another member\'s XP, level, and server rank')
    .addUserOption(opt => opt.setName('user').setDescription('The user whose rank you want to view')),
  name: 'rank',
  description: 'Check your or another member\'s XP, level, and server rank',
  aliases: ['level', 'xp'],
  module: 'leveling',

  async execute(interaction, client, settings) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const embed = await buildRankEmbed(interaction.guild, targetUser);
    return interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message, args, client, settings) {
    let targetUser = message.mentions.users.first();
    if (!targetUser && args[0]) {
      targetUser = await client.users.fetch(args[0]).catch(() => null);
    }
    if (!targetUser) targetUser = message.author;

    const embed = await buildRankEmbed(message.guild, targetUser);
    return message.reply({ embeds: [embed] });
  }
};

async function buildRankEmbed(guild, user) {
  let userDoc = await UserXP.findOne({ guildId: guild.id, userId: user.id });
  if (!userDoc) {
    userDoc = { xp: 0, level: 0, totalMessages: 0 };
  }

  // Calculate user position on leaderboard
  const rankCount = await UserXP.countDocuments({
    guildId: guild.id,
    $or: [
      { level: { $gt: userDoc.level } },
      { level: userDoc.level, xp: { $gt: userDoc.xp } }
    ]
  });
  const rank = rankCount + 1;

  const nextLevelXp = levelingService.getXpForLevel(userDoc.level);
  const percent = Math.min(100, Math.round((userDoc.xp / nextLevelXp) * 100));

  // Visual ASCII progress bar
  const totalBars = 14;
  const filledBars = Math.round((percent / 100) * totalBars);
  const progressBar = '▰'.repeat(filledBars) + '▱'.repeat(totalBars - filledBars);

  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setAuthor({ name: `${user.username}'s Rank Card`, iconURL: user.displayAvatarURL({ dynamic: true }) })
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '🏆 Rank', value: `#**${rank}**`, inline: true },
      { name: '⭐ Level', value: `**${userDoc.level}**`, inline: true },
      { name: '💬 Messages', value: `**${userDoc.totalMessages || 0}**`, inline: true },
      { name: 'Progress', value: `${progressBar} **${percent}%**\n\`${userDoc.xp.toLocaleString()} / ${nextLevelXp.toLocaleString()} XP\`` }
    )
    .setFooter({ text: guild.name, iconURL: guild.iconURL({ dynamic: true }) })
    .setTimestamp();
}
