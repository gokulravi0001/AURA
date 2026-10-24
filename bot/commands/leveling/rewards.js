const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Guild = require('../../../models/Guild');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reward')
    .setDescription('View or manage leveling role rewards')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View all level role rewards configured for this server')
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a new role reward for reaching a level (Admin only)')
        .addIntegerOption(opt => opt.setName('level').setDescription('Level requirement').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to award').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a role reward for a level (Admin only)')
        .addIntegerOption(opt => opt.setName('level').setDescription('Level requirement to remove').setRequired(true))
    ),
  name: 'reward',
  description: 'View or manage leveling role rewards',
  aliases: ['rewards', 'rolerewards', 'levelrewards'],
  module: 'leveling',

  async execute(interaction, client, settings) {
    const sub = interaction.options.getSubcommand();
    const guildDoc = await Guild.findOne({ guildId: interaction.guild.id });

    if (sub === 'view') {
      const embed = buildRewardsEmbed(interaction.guild, guildDoc);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'add') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      }

      const level = interaction.options.getInteger('level');
      const role = interaction.options.getRole('role');

      if (level <= 0) {
        return interaction.reply({ content: '❌ Level must be greater than 0.', ephemeral: true });
      }

      const existing = (guildDoc.leveling.roleRewards || []).filter(r => r.level !== level);
      existing.push({ level, roleId: role.id });
      existing.sort((a, b) => a.level - b.level);

      guildDoc.leveling.roleRewards = existing;
      await guildDoc.save();

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('✨ Role Reward Added')
            .setDescription(`Members who reach **Level ${level}** will now automatically receive <@&${role.id}>!`)
        ]
      });
    }

    if (sub === 'remove') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      }

      const level = interaction.options.getInteger('level');
      const current = guildDoc.leveling.roleRewards || [];
      const updated = current.filter(r => r.level !== level);

      if (current.length === updated.length) {
        return interaction.reply({ content: `⚠️ No role reward found for Level ${level}.`, ephemeral: true });
      }

      guildDoc.leveling.roleRewards = updated;
      await guildDoc.save();

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('🗑️ Role Reward Removed')
            .setDescription(`Removed role reward for **Level ${level}**.`)
        ]
      });
    }
  },

  async executePrefix(message, args, client, settings) {
    const action = args[0]?.toLowerCase();
    const guildDoc = await Guild.findOne({ guildId: message.guild.id });

    if (action === 'add') {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('🚫 Administrator permission required.');
      }

      const level = parseInt(args[1], 10);
      const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[2]);

      if (isNaN(level) || level <= 0 || !role) {
        return message.reply('❌ Usage: `+reward add <level> <@role>` (e.g. `+reward add 5 @VIP`)');
      }

      const existing = (guildDoc.leveling.roleRewards || []).filter(r => r.level !== level);
      existing.push({ level, roleId: role.id });
      existing.sort((a, b) => a.level - b.level);

      guildDoc.leveling.roleRewards = existing;
      await guildDoc.save();

      return message.reply(`✨ Role reward added! Level **${level}** awards <@&${role.id}>.`);
    }

    if (action === 'remove') {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply('🚫 Administrator permission required.');
      }

      const level = parseInt(args[1], 10);
      if (isNaN(level)) {
        return message.reply('❌ Usage: `+reward remove <level>`');
      }

      const current = guildDoc.leveling.roleRewards || [];
      const updated = current.filter(r => r.level !== level);

      guildDoc.leveling.roleRewards = updated;
      await guildDoc.save();

      return message.reply(`🗑️ Removed role reward for Level **${level}**.`);
    }

    // Default: view
    const embed = buildRewardsEmbed(message.guild, guildDoc);
    return message.reply({ embeds: [embed] });
  }
};

function buildRewardsEmbed(guild, guildDoc) {
  const rewards = (guildDoc?.leveling?.roleRewards || []).sort((a, b) => a.level - b.level);

  if (!rewards.length) {
    return new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`🏆 Level Role Rewards — ${guild.name}`)
      .setDescription('No role rewards set yet on this server.\nAdmins can add rewards with `/reward add <level> <role>` or `+reward add <level> @role`.')
      .setFooter({ text: 'AURA Leveling System' });
  }

  let desc = '';
  for (const r of rewards) {
    desc += `⭐ **Level ${r.level}** ➔ <@&${r.roleId}>\n`;
  }

  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`🏆 Level Role Rewards — ${guild.name}`)
    .setDescription(desc)
    .setFooter({ text: 'Earn XP by chatting to unlock roles!' })
    .setTimestamp();
}
