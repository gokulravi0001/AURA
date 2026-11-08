const {
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder
} = require('discord.js');
const { COLORS } = require('../../../shared/constants');
const { isOwnerOrAdmin } = require('../../../shared/permissionHelper');
const bounceManager = require('../../modules/bounceManager');
const immunityService = require('../../../shared/immunityService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bounce')
    .setDescription('Move a member across all voice channels one by one in a few seconds')
    .addUserOption(opt =>
      opt.setName('target')
        .setDescription('The member to tour across all voice channels')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('rounds')
        .setDescription('Number of rounds to tour through all VCs (1-100, default: 1)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName('count')
        .setDescription('Alias for rounds: number of rounds to tour (1-100, default: 1)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName('return_to_start')
        .setDescription('Return member to their starting channel when finished (default: true)')
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName('stop')
        .setDescription('Stop an active voice bounce for this member')
        .setRequired(false)
    ),

  name: 'bounce',
  description: 'Move a member across all voice channels one by one in a few seconds',
  aliases: ['vcbounce', 'orbit', 'vcorbit', 'tour', 'vctour', 'drag', 'vcdrag'],

  async execute(interaction, client, settings) {
    if (!isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client)) {
      return interaction.reply({
        content: '🚫 The `/bounce` command can only be used by the **Bot Developer**, **Server Owner**, and **Administrators**.',
        ephemeral: true
      });
    }

    const guild = interaction.guild;
    const botMember = await guild.members.fetchMe().catch(() => null);
    if (!botMember?.permissions.has(PermissionsBitField.Flags.MoveMembers) &&
        !botMember?.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '🚫 I do not have the **Move Members** permission in this server to bounce members.', ephemeral: true });
    }

    const targetMember = interaction.options.getMember('target');
    if (!targetMember) {
      return interaction.reply({ content: '❌ Target member not found in this server.', ephemeral: true });
    }

    // Stop option: /bounce target:@user stop:true
    const isStop = interaction.options.getBoolean('stop');
    if (isStop) {
      if (bounceManager.isBouncing(targetMember.id)) {
        bounceManager.stopBounce(targetMember.id);
        return interaction.reply({ content: `🛑 Stopping voice bounce for <@${targetMember.id}>...` });
      }
      return interaction.reply({ content: `⚠️ No active voice bounce found for <@${targetMember.id}>.`, ephemeral: true });
    }

    if (targetMember.id === client.user.id) {
      return interaction.reply({ content: '❌ I cannot bounce myself!', ephemeral: true });
    }

    if (immunityService.isImmune(targetMember, guild, client, settings)) {
      return interaction.reply({
        content: `🛡️ **Immunity Protected**: <@${targetMember.id}> possesses **Immunity** and cannot be targeted by the voice bounce command.`,
        ephemeral: true
      });
    }

    const currentVoice = guild.voiceStates.cache.get(targetMember.id);
    if (!currentVoice?.channelId) {
      return interaction.reply({ content: `❌ <@${targetMember.id}> is not currently connected to any voice channel.`, ephemeral: true });
    }

    if (targetMember.roles.highest.position >= botMember.roles.highest.position &&
        !botMember.permissions.has(PermissionsBitField.Flags.Administrator) &&
        targetMember.id !== interaction.user.id) {
      return interaction.reply({ content: '🚫 I cannot move this member due to role hierarchy.', ephemeral: true });
    }

    if (bounceManager.isBouncing(targetMember.id)) {
      return interaction.reply({ content: `⚠️ <@${targetMember.id}> is already in an active voice bounce tour. Use \`/bounce target:@member stop:true\` to stop it.`, ephemeral: true });
    }

    const rawRounds = interaction.options.getInteger('rounds') || interaction.options.getInteger('count') || 1;
    const rounds = Math.min(100, Math.max(1, rawRounds));
    const returnToStart = interaction.options.getBoolean('return_to_start') !== false;

    await interaction.reply({
      content: `🌀 **Starting Voice Bounce for <@${targetMember.id}>!**\nTarget: **${rounds}** round${rounds === 1 ? '' : 's'} *(Round 1/${rounds} starting)*...`
    });

    const result = await bounceManager.startBounce({
      guild,
      targetMember,
      botMember,
      rounds,
      returnToStart,
      initiatorTag: interaction.user.tag,
      onProgress: async (completed, total, moved) => {
        await interaction.editReply({
          content: `🌀 **Voice Bounce in progress for <@${targetMember.id}>...**\nCompleted **${completed}/${total}** rounds (**${moved}** moves, ${Math.round((completed / total) * 100)}%)...`
        }).catch(() => {});
      }
    });

    if (!result.success) {
      return interaction.editReply({ content: result.error || 'Failed to start voice bounce.' });
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('🌀 Voice Bounce Completed!')
      .setDescription(
        `Successfully moved <@${targetMember.id}> across **${result.movedCount}** voice channels over **${result.completedRounds}/${rounds}** round${rounds === 1 ? '' : 's'} in **${(result.movedCount * 0.8).toFixed(1)}** seconds!` +
        (returnToStart ? `\nReturned back to <#${result.startChannelId}>.` : '') +
        (result.canceled ? '\n⚠️ *Operation was stopped early.*' : '')
      )
      .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    return interaction.editReply({ content: null, embeds: [embed] });
  },

  async executePrefix(message, args, client, settings) {
    if (!isOwnerOrAdmin(message.member || message.author, message.guild, client)) {
      return message.reply('🚫 The `+bounce` command can only be used by the **Bot Developer**, **Server Owner**, and **Administrators**.');
    }

    const guild = message.guild;
    const botMember = await guild.members.fetchMe().catch(() => null);
    if (!botMember?.permissions.has(PermissionsBitField.Flags.MoveMembers) &&
        !botMember?.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('🚫 I do not have the **Move Members** permission in this server to bounce members.');
    }

    // Stop command: +bounce stop @member
    const isStop = args.some(a => ['stop', 'cancel', 'halt'].includes(a.toLowerCase()));

    let targetMember = message.mentions.members.first();
    if (!targetMember && args[0]) {
      const rawId = args[0].replace(/[<@!>]/g, '');
      targetMember = guild.members.cache.get(rawId) ||
        guild.members.cache.find(m => m.user.username.toLowerCase() === args[0].toLowerCase());
    }

    if (isStop) {
      if (targetMember && bounceManager.isBouncing(targetMember.id)) {
        bounceManager.stopBounce(targetMember.id);
        return message.reply(`🛑 Stopping voice bounce for <@${targetMember.id}>...`);
      }
      return message.reply('⚠️ No active voice bounce found for that member.');
    }

    if (!targetMember) {
      return message.reply(
        '❌ Please specify the member to bounce across voice channels!\n' +
        '• **Usage:** `+bounce @member [rounds]`\n' +
        '• **Examples:** `+bounce @member 10` or `+bounce @member count:100`\n' +
        '• **Stop Tour:** `+bounce stop @member`\n' +
        '• **Don\'t return:** `+bounce @member 10 false`'
      );
    }

    if (targetMember.id === client.user.id) {
      return message.reply('❌ I cannot bounce myself!');
    }

    if (immunityService.isImmune(targetMember, guild, client, settings)) {
      return message.reply(`🛡️ **Immunity Protected**: <@${targetMember.id}> possesses **Immunity** and cannot be targeted by the voice bounce command.`);
    }

    const currentVoice = guild.voiceStates.cache.get(targetMember.id);
    if (!currentVoice?.channelId) {
      return message.reply(`❌ <@${targetMember.id}> is not currently connected to any voice channel.`);
    }

    // Check role hierarchy
    if (targetMember.roles.highest.position >= botMember.roles.highest.position &&
        !botMember.permissions.has(PermissionsBitField.Flags.Administrator) &&
        targetMember.id !== message.author.id) {
      return message.reply('🚫 I cannot move this member due to role hierarchy.');
    }

    if (bounceManager.isBouncing(targetMember.id)) {
      return message.reply(`⚠️ <@${targetMember.id}> is already in an active voice bounce tour. Use \`+bounce stop @member\` to stop it.`);
    }

    // Parse rounds accurately (supports 10, count 10, count:10, rounds:100, etc.)
    const rounds = bounceManager.parseRounds(args);
    const returnToStart = !args.some(a => ['false', 'no', '0'].includes(a.toLowerCase()));

    const startMsg = await message.reply(
      `🌀 **Starting Voice Bounce for <@${targetMember.id}>!**\n` +
      `Target: **${rounds}** round${rounds === 1 ? '' : 's'}... *(Type \`+bounce stop @member\` to cancel)*`
    );

    const result = await bounceManager.startBounce({
      guild,
      targetMember,
      botMember,
      rounds,
      returnToStart,
      initiatorTag: message.author.tag,
      onProgress: async (completed, total, moved) => {
        await startMsg.edit(
          `🌀 **Voice Bounce in progress for <@${targetMember.id}>...**\n` +
          `Completed **${completed}/${total}** rounds (**${moved}** moves, ${Math.round((completed / total) * 100)}%)... *(Type \`+bounce stop @member\` to cancel)*`
        ).catch(() => {});
      }
    });

    if (!result.success) {
      return startMsg.edit(result.error || 'Failed to start voice bounce.');
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('🌀 Voice Bounce Completed!')
      .setDescription(
        `Successfully moved <@${targetMember.id}> across **${result.movedCount}** voice channels over **${result.completedRounds}/${rounds}** round${rounds === 1 ? '' : 's'} in **${(result.movedCount * 0.8).toFixed(1)}** seconds!` +
        (returnToStart ? `\nReturned back to <#${result.startChannelId}>.` : '') +
        (result.canceled ? '\n⚠️ *Operation was stopped early.*' : '')
      )
      .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    return startMsg.edit({ content: null, embeds: [embed] }).catch(() => message.reply({ embeds: [embed] }));
  }
};
