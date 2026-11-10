const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  PermissionsBitField,
  EmbedBuilder,
  ChannelType
} = require('discord.js');
const autoDeleteService = require('../../../shared/autoDeleteService');
const immunityService = require('../../../shared/immunityService');
const { isOwnerOrAdmin } = require('../../../shared/permissionHelper');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autodlt')
    .setDescription('Automatically delete messages from a target user within a second for a set duration')
    .addUserOption(opt =>
      opt.setName('target')
        .setDescription('The member whose messages will be automatically deleted within a second')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('duration')
        .setDescription('How long autodlt happens (e.g. 30s, 5m, 10m, 1h, 1d, or "stop" to cancel)')
        .setRequired(true)
    )
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Limit autodlt to a specific channel (leave empty for entire server)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice)
        .setRequired(false)
    ),

  name: 'autodlt',
  description: 'Automatically delete messages from a target user within a second for a set duration',
  aliases: ['autodelete', 'shadowmute', 'unshadowmute', 'shred', 'silence', 'unsilence'],
  permissions: [PermissionFlagsBits.ManageMessages],
  module: 'moderation',

  async execute(interaction, client, settings) {
    const guild = interaction.guild;
    const caller = interaction.member || interaction.user;

    // Permission check: Bot Developer, Server Owner, or Administrators
    if (!isOwnerOrAdmin(caller, guild, client, settings)) {
      return interaction.reply({
        content: '🚫 The `/autodlt` command can only be used by the **Bot Developer**, **Server Owner**, and **Administrators**.',
        ephemeral: true
      });
    }

    // Check if bot has Manage Messages permission
    const botMember = await guild.members.fetchMe().catch(() => null);
    const canManage = botMember?.permissions.has(PermissionsBitField.Flags.ManageMessages) ||
                      botMember?.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!canManage) {
      return interaction.reply({
        content: '⚠️ **Missing Permission**: I need the **Manage Messages** permission in server settings to automatically delete messages! Please grant **Manage Messages** to the AURA bot role.',
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser('target');
    const durationStr = interaction.options.getString('duration');
    const targetChannel = interaction.options.getChannel('channel');

    if (targetUser.id === client.user.id) {
      return interaction.reply({ content: '❌ I cannot apply autodlt to myself!', ephemeral: true });
    }

    // Check Permanent Absolute Immunity
    if (immunityService.isAbsoluteImmune(targetUser.id)) {
      return interaction.reply({
        content: `🛡️ **Immunity Protected**: <@${targetUser.id}> possesses **Permanent Absolute Immunity** and cannot have autodlt applied to them (even by the Server Owner).`,
        ephemeral: true
      });
    }

    const parsed = autoDeleteService.parseDuration(durationStr);
    if (!parsed) {
      return interaction.reply({
        content: '❌ Invalid duration format! Please use formats like `30s`, `5m`, `10m`, `1h`, `1d`, or `stop` to cancel.',
        ephemeral: true
      });
    }

    // Stop autodlt
    if (parsed.stop) {
      await autoDeleteService.removeUserRule(guild.id, targetUser.id);
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('🔓 Auto-Delete Stopped')
            .setDescription(`Stopped autodlt for <@${targetUser.id}>. Their messages will no longer be deleted.`)
            .setTimestamp()
        ]
      });
    }

    // Set user autodlt: message will be sent, then deleted within a second (800ms)
    const result = await autoDeleteService.setUserRule(
      guild.id,
      targetUser.id,
      parsed.ms,
      targetChannel?.id || null,
      interaction.user.id,
      800
    );

    if (!result.success) {
      return interaction.reply({ content: result.error || 'Failed to activate autodlt.', ephemeral: true });
    }

    const scopeNote = targetChannel ? `in <#${targetChannel.id}>` : 'across **all channels in the server**';

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.ERROR)
          .setTitle('⚡ Auto-Delete (Within 1s) Activated!')
          .setDescription(
            `Target user <@${targetUser.id}> is now under **Auto-Delete**!\n` +
            `They can type and send messages, but **every message will be automatically deleted within a second** for the next **${result.formattedDuration}**!\n\n` +
            `• **Target Member:** <@${targetUser.id}> (\`${targetUser.id}\`)\n` +
            `• **Scope:** ${scopeNote}\n` +
            `• **Duration:** ${result.formattedDuration}\n` +
            `• **Action:** Visible for ~1 second, then vanished automatically\n` +
            `• **To Stop Early:** \`/autodlt target:@${targetUser.username} duration:stop\` (or \`+autodlt @${targetUser.username} stop\`)`
          )
          .setFooter({ text: `Activated by ${interaction.user.username}` })
          .setTimestamp()
      ]
    });
  },

  async executePrefix(message, args, client, settings) {
    const guild = message.guild;
    const caller = message.member || message.author;

    if (!isOwnerOrAdmin(caller, guild, client, settings)) {
      return message.reply('🚫 The `+autodlt` command can only be used by the **Bot Developer**, **Server Owner**, and **Administrators**.');
    }

    // Check bot permission
    const botMember = await guild.members.fetchMe().catch(() => null);
    const canManage = botMember?.permissions.has(PermissionsBitField.Flags.ManageMessages) ||
                      botMember?.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!canManage) {
      return message.reply('⚠️ **Missing Permission**: I need the **Manage Messages** permission to automatically delete messages! Please grant **Manage Messages** to the AURA bot role.');
    }

    const firstArg = args[0]?.toLowerCase();

    // 1. List active rules: +autodlt list
    if (firstArg === 'list') {
      const active = autoDeleteService.getActiveRules(guild.id);
      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`⏳ Active Auto-Deletions — ${guild.name}`)
        .setDescription(
          `**👤 Active User Auto-Deletions (Deleted within 1s):**\n` +
          (active.users.length > 0
            ? active.users.map(u => `• <@${u.userId}> — Time Remaining: **${u.timeRemaining}** ${u.channelId ? `*(Only in <#${u.channelId}>)*` : '*(Server-wide)*'}`).join('\n')
            : '*No users currently set for autodlt.*') +
          `\n\n**📢 Active Channel Auto-Deletions:**\n` +
          (active.channels.length > 0
            ? active.channels.map(c => `• <#${c.channelId}> — Time Remaining: **${c.timeRemaining}**`).join('\n')
            : '*No channels currently set for autodlt.*')
        )
        .setFooter({ text: 'AURA Auto-Delete System • Use +autodlt @user <duration>' })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // 2. Channel autodlt: +autodlt channel [#channel] <duration>
    if (firstArg === 'channel') {
      const targetChannel = message.mentions.channels.first() || message.channel;
      const nonChannelArgs = args.slice(1).filter(a => !a.startsWith('<#'));
      const durationStr = nonChannelArgs[0] || '10m';

      const parsed = autoDeleteService.parseDuration(durationStr);
      if (!parsed) {
        return message.reply('❌ Invalid duration format! Use e.g. `+autodlt channel 10m` or `+autodlt channel #General 1h`.');
      }

      if (parsed.stop) {
        await autoDeleteService.removeChannelRule(guild.id, targetChannel.id);
        return message.reply(`🔓 Auto-deletion stopped for <#${targetChannel.id}>.`);
      }

      const result = await autoDeleteService.setChannelRule(guild.id, targetChannel.id, parsed.ms, 0, message.author.id);
      return message.reply(`⏳ **Channel Auto-Delete Activated**: All incoming messages in <#${targetChannel.id}> will be automatically deleted within a second for **${result.formattedDuration}**!`);
    }

    // 3. User autodlt: +autodlt @user <duration> OR +autodlt @user stop
    let targetUser = message.mentions.users.first();
    let durationStr = args[1];

    if (!targetUser && args[0]) {
      const rawId = args[0].replace(/[<@!>]/g, '');
      targetUser = await client.users.fetch(rawId).catch(() => null);
      durationStr = args[1];
    }

    if (firstArg === 'stop' || firstArg === 'clear') {
      if (args[1]?.toLowerCase() === 'all') {
        await autoDeleteService.clearAll(guild.id);
        return message.reply('🧹 Cleared all active autodlt rules on this server.');
      }
      let stopUser = message.mentions.users.first();
      if (!stopUser && args[1]) {
        const rawId = args[1].replace(/[<@!>]/g, '');
        stopUser = await client.users.fetch(rawId).catch(() => null);
      }
      if (stopUser) {
        await autoDeleteService.removeUserRule(guild.id, stopUser.id);
        return message.reply(`🔓 Stopped autodlt for <@${stopUser.id}>.`);
      }
      return message.reply('❌ Usage to stop: `+autodlt stop @user` or `+autodlt stop all`');
    }

    if (!targetUser) {
      return message.reply(
        '❓ **Auto-Delete (+autodlt) Usage:**\n' +
        '• **Target a user:** `+autodlt @user <duration>` *(e.g. `+autodlt @user 10m` or `+autodlt @user 30s`)*\n' +
        '• **Stop for a user:** `+autodlt @user stop` (or `+autodlt stop @user`)\n' +
        '• **Target a channel:** `+autodlt channel [#channel] <duration>`\n' +
        '• **View active rules:** `+autodlt list`\n' +
        '• **Clear all rules:** `+autodlt stop all`'
      );
    }

    if (targetUser.id === client.user.id) {
      return message.reply('❌ I cannot apply autodlt to myself!');
    }

    if (immunityService.isAbsoluteImmune(targetUser.id)) {
      return message.reply(`🛡️ **Immunity Protected**: <@${targetUser.id}> possesses **Permanent Absolute Immunity** and cannot have autodlt applied to them (even by the Server Owner).`);
    }

    const parsed = autoDeleteService.parseDuration(durationStr || '10m');
    if (!parsed) {
      return message.reply('❌ Invalid duration format! Use e.g. `30s`, `5m`, `10m`, `1h`, `1d`, or `stop`.');
    }

    if (parsed.stop) {
      await autoDeleteService.removeUserRule(guild.id, targetUser.id);
      return message.reply(`🔓 Stopped autodlt for <@${targetUser.id}>.`);
    }

    const result = await autoDeleteService.setUserRule(guild.id, targetUser.id, parsed.ms, null, message.author.id, 800);
    if (!result.success) return message.reply(result.error);

    return message.reply(
      `⚡ **Auto-Delete (Within 1s) Activated**: <@${targetUser.id}> can send messages, but **every message will be automatically deleted within a second** for **${result.formattedDuration}**!\n` +
      `*(To stop early: \`+autodlt @${targetUser.username} stop\`)*`
    );
  }
};
