const {
  SlashCommandBuilder,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder
} = require('discord.js');
const { COLORS } = require('../../../shared/constants');

// Set to prevent concurrent bounce operations on the same member
const activeBounces = new Set();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bounce')
    .setDescription('Move a member across all voice channels one by one in a few seconds')
    .addUserOption(opt =>
      opt.setName('target')
        .setDescription('The member to tour across all voice channels')
        .setRequired(true)
    )
    .addBooleanOption(opt =>
      opt.setName('return_to_start')
        .setDescription('Return member to their starting channel when finished (default: true)')
        .setRequired(false)
    ),

  name: 'bounce',
  description: 'Move a member across all voice channels one by one in a few seconds',
  aliases: ['vcbounce', 'orbit', 'vcorbit', 'tour', 'vctour', 'drag', 'vcdrag'],

  async execute(interaction, client, settings) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.MoveMembers) &&
        !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: '🚫 You need the **Move Members** permission to use voice bounce.', ephemeral: true });
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

    if (targetMember.id === client.user.id) {
      return interaction.reply({ content: '❌ I cannot bounce myself!', ephemeral: true });
    }

    const startChannel = targetMember.voice?.channel;
    if (!startChannel) {
      return interaction.reply({ content: `❌ <@${targetMember.id}> is not currently connected to any voice channel.`, ephemeral: true });
    }

    if (targetMember.roles.highest.position >= botMember.roles.highest.position &&
        !botMember.permissions.has(PermissionsBitField.Flags.Administrator) &&
        targetMember.id !== interaction.user.id) {
      return interaction.reply({ content: '🚫 I cannot move this member due to role hierarchy.', ephemeral: true });
    }

    if (activeBounces.has(targetMember.id)) {
      return interaction.reply({ content: `⚠️ <@${targetMember.id}> is already in an active voice bounce tour.`, ephemeral: true });
    }

    const returnToStart = interaction.options.getBoolean('return_to_start') !== false;

    const candidateChannels = [...guild.channels.cache.values()]
      .filter(c =>
        c.isVoiceBased() &&
        c.type === ChannelType.GuildVoice &&
        c.id !== startChannel.id &&
        botMember.permissionsIn(c).has(PermissionsBitField.Flags.Connect) &&
        botMember.permissionsIn(c).has(PermissionsBitField.Flags.MoveMembers)
      )
      .sort((a, b) => a.rawPosition - b.rawPosition);

    if (candidateChannels.length === 0) {
      return interaction.reply({ content: `❌ There are no other available voice channels to bounce <@${targetMember.id}> to.`, ephemeral: true });
    }

    const tourChannels = candidateChannels.slice(0, 15);

    await interaction.reply({
      content: `🌀 **Starting Voice Bounce for <@${targetMember.id}>!**\nTouring across **${tourChannels.length}** voice channels...`
    });

    activeBounces.add(targetMember.id);

    let movedCount = 0;
    for (const ch of tourChannels) {
      if (!targetMember.voice?.channel) break;
      try {
        await targetMember.voice.setChannel(ch.id, `Voice bounce initiated by ${interaction.user.tag}`);
        movedCount++;
      } catch (_) {}
      await new Promise(r => setTimeout(r, 750));
    }

    if (returnToStart && targetMember.voice?.channel) {
      await targetMember.voice.setChannel(startChannel.id).catch(() => {});
    }

    activeBounces.delete(targetMember.id);

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('🌀 Voice Bounce Completed!')
      .setDescription(
        `Successfully moved <@${targetMember.id}> across **${movedCount}** voice channel${movedCount === 1 ? '' : 's'} in **${(movedCount * 0.75).toFixed(1)}** seconds!` +
        (returnToStart ? `\nReturned back to <#${startChannel.id}>.` : '')
      )
      .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    return interaction.editReply({ content: null, embeds: [embed] });
  },

  async executePrefix(message, args, client, settings) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.MoveMembers) &&
        !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('🚫 You need the **Move Members** permission to use voice bounce.');
    }

    const guild = message.guild;
    const botMember = await guild.members.fetchMe().catch(() => null);
    if (!botMember?.permissions.has(PermissionsBitField.Flags.MoveMembers) &&
        !botMember?.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('🚫 I do not have the **Move Members** permission in this server to bounce members.');
    }

    let targetMember = message.mentions.members.first();
    if (!targetMember && args[0]) {
      const rawId = args[0].replace(/[<@!>]/g, '');
      targetMember = guild.members.cache.get(rawId) ||
        guild.members.cache.find(m => m.user.username.toLowerCase() === args[0].toLowerCase());
    }

    if (!targetMember) {
      return message.reply(
        '❌ Please specify the member to bounce across voice channels!\n' +
        '• **Usage:** `+bounce @member`\n' +
        '• **Or:** `+vcbounce @member`\n' +
        '• **Optional:** `+bounce @member false` *(to not return to starting channel)*'
      );
    }

    if (targetMember.id === client.user.id) {
      return message.reply('❌ I cannot bounce myself!');
    }

    const startChannel = targetMember.voice?.channel;
    if (!startChannel) {
      return message.reply(`❌ <@${targetMember.id}> is not currently connected to any voice channel.`);
    }

    // Check role hierarchy
    if (targetMember.roles.highest.position >= botMember.roles.highest.position &&
        !botMember.permissions.has(PermissionsBitField.Flags.Administrator) &&
        targetMember.id !== message.author.id) {
      return message.reply('🚫 I cannot move this member due to role hierarchy.');
    }

    if (activeBounces.has(targetMember.id)) {
      return message.reply(`⚠️ <@${targetMember.id}> is already in an active voice bounce tour.`);
    }

    const returnToStart = !args.some(a => ['false', 'no', '0'].includes(a.toLowerCase()));

    const candidateChannels = [...guild.channels.cache.values()]
      .filter(c =>
        c.isVoiceBased() &&
        c.type === ChannelType.GuildVoice &&
        c.id !== startChannel.id &&
        botMember.permissionsIn(c).has(PermissionsBitField.Flags.Connect) &&
        botMember.permissionsIn(c).has(PermissionsBitField.Flags.MoveMembers)
      )
      .sort((a, b) => a.rawPosition - b.rawPosition);

    if (candidateChannels.length === 0) {
      return message.reply(`❌ There are no other available voice channels to bounce <@${targetMember.id}> to.`);
    }

    const tourChannels = candidateChannels.slice(0, 15);

    activeBounces.add(targetMember.id);
    const startMsg = await message.reply(
      `🌀 **Starting Voice Bounce for <@${targetMember.id}>!**\n` +
      `Touring through **${tourChannels.length}** voice channels...`
    );

    let movedCount = 0;
    for (const ch of tourChannels) {
      if (!targetMember.voice?.channel) break;
      try {
        await targetMember.voice.setChannel(ch.id, `Voice bounce initiated by ${message.author.tag}`);
        movedCount++;
      } catch (_) {}
      await new Promise(r => setTimeout(r, 750));
    }

    if (returnToStart && targetMember.voice?.channel) {
      await targetMember.voice.setChannel(startChannel.id).catch(() => {});
    }

    activeBounces.delete(targetMember.id);

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('🌀 Voice Bounce Completed!')
      .setDescription(
        `Successfully moved <@${targetMember.id}> across **${movedCount}** voice channel${movedCount === 1 ? '' : 's'} in **${(movedCount * 0.75).toFixed(1)}** seconds!` +
        (returnToStart ? `\nReturned back to <#${startChannel.id}>.` : '')
      )
      .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    return startMsg.edit({ content: null, embeds: [embed] }).catch(() => message.reply({ embeds: [embed] }));
  }
};
