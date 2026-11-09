const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType
} = require('discord.js');
const autoDeleteService = require('../../../shared/autoDeleteService');
const immunityService = require('../../../shared/immunityService');
const { isOwnerOrAdmin, canManageWhitelist } = require('../../../shared/permissionHelper');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autodelete')
    .setDescription('Automatically delete incoming messages in a channel or from a specific user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(sub =>
      sub.setName('channel')
        .setDescription('Automatically delete incoming messages in a channel for a duration')
        .addStringOption(opt =>
          opt.setName('duration')
            .setDescription('Duration (e.g. 10m, 1h, 30s, 2d, or "stop" to cancel)')
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('The channel to auto-delete messages in (defaults to current channel)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice)
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('delay')
            .setDescription('Seconds to wait before deleting (0 = instant, 5 = disappearing after 5s)')
            .setMinValue(0)
            .setMaxValue(300)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('user')
        .setDescription('Automatically delete all incoming messages from a user for a duration (Shadow-Mute)')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('The member whose messages will be automatically deleted')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('duration')
            .setDescription('Duration (e.g. 10m, 1h, 30s, 2d, or "stop" to cancel)')
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Limit deletion to a specific channel (leave empty for entire server)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('stop')
        .setDescription('Stop active auto-deletion on a channel, user, or all rules')
        .addStringOption(opt =>
          opt.setName('target')
            .setDescription('What to stop auto-deletion for')
            .addChoices(
              { name: 'Channel', value: 'channel' },
              { name: 'User', value: 'user' },
              { name: 'All (Clear All)', value: 'all' }
            )
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to stop auto-delete in (for channel target)')
            .setRequired(false)
        )
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('User to stop auto-delete for (for user target)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all currently active auto-deletions on this server')
    ),

  name: 'autodelete',
  description: 'Automatically delete incoming messages in a channel or from a specific user',
  aliases: ['shadowmute', 'unshadowmute', 'silence', 'unsilence', 'shred', 'ghost'],
  permissions: [PermissionFlagsBits.ManageMessages],
  module: 'moderation',

  async execute(interaction, client, settings) {
    const guild = interaction.guild;
    const caller = interaction.member || interaction.user;

    if (!isOwnerOrAdmin(caller, guild, client, settings)) {
      return interaction.reply({
        content: '🚫 The `/autodelete` command can only be used by the **Bot Developer**, **Server Owner**, and **Administrators**.',
        ephemeral: true
      });
    }

    const sub = interaction.options.getSubcommand();

    // 1. CHANNEL AUTO-DELETE
    if (sub === 'channel') {
      const durationStr = interaction.options.getString('duration');
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
      const delay = interaction.options.getInteger('delay') || 0;

      const parsed = autoDeleteService.parseDuration(durationStr);
      if (!parsed) {
        return interaction.reply({
          content: '❌ Invalid duration format! Please use formats like `30s`, `10m`, `1h`, `2d`, or `stop`.',
          ephemeral: true
        });
      }

      if (parsed.stop) {
        await autoDeleteService.removeChannelRule(guild.id, targetChannel.id);
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.SUCCESS)
              .setTitle('🔓 Channel Auto-Delete Disabled')
              .setDescription(`Stopped auto-deletion in <#${targetChannel.id}>. Normal messages will no longer be deleted.`)
              .setTimestamp()
          ]
        });
      }

      const result = await autoDeleteService.setChannelRule(guild.id, targetChannel.id, parsed.ms, delay, interaction.user.id);

      const delayNote = delay > 0 ? ` (after a **${delay}s** delay)` : ' (**instantly** upon sending)';
      const expNote = parsed.ms ? ` for the next **${result.formattedDuration}**` : ' **permanently** until stopped';

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.WARNING)
            .setTitle('⏳ Channel Auto-Delete Activated')
            .setDescription(
              `All incoming messages sent in <#${targetChannel.id}> will be automatically deleted${delayNote}${expNote}!\n\n` +
              `• **Target Channel:** <#${targetChannel.id}>\n` +
              `• **Duration:** ${result.formattedDuration}\n` +
              `• **Mode:** ${delay > 0 ? `Disappearing Messages (${delay}s)` : 'Instant Deletion'}\n` +
              `• **Exemptions:** Immune members and administrative commands are protected.\n` +
              `• **Stop Command:** \`/autodelete stop target:Channel channel:#${targetChannel.name}\``
            )
            .setFooter({ text: `Activated by ${interaction.user.username}` })
            .setTimestamp()
        ]
      });
    }

    // 2. USER AUTO-DELETE (Shadow-Mute / Message Shredder)
    if (sub === 'user') {
      const targetUser = interaction.options.getUser('user');
      const durationStr = interaction.options.getString('duration');
      const targetChannel = interaction.options.getChannel('channel');

      if (targetUser.id === client.user.id) {
        return interaction.reply({ content: '❌ I cannot apply auto-delete to myself!', ephemeral: true });
      }

      // Check Immunity upfront
      if (immunityService.isImmune(targetUser.id, guild, client, settings)) {
        return interaction.reply({
          content: `🛡️ **Immunity Protected**: <@${targetUser.id}> possesses **Immunity** and cannot have auto-delete applied to them (even by the Server Owner).`,
          ephemeral: true
        });
      }

      const parsed = autoDeleteService.parseDuration(durationStr);
      if (!parsed) {
        return interaction.reply({
          content: '❌ Invalid duration format! Please use formats like `30s`, `10m`, `1h`, `2d`, or `stop`.',
          ephemeral: true
        });
      }

      if (parsed.stop) {
        await autoDeleteService.removeUserRule(guild.id, targetUser.id);
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.SUCCESS)
              .setTitle('🔓 User Auto-Delete Disabled')
              .setDescription(`Stopped auto-deletion for <@${targetUser.id}>. Their messages will no longer be shredded.`)
              .setTimestamp()
          ]
        });
      }

      const result = await autoDeleteService.setUserRule(guild.id, targetUser.id, parsed.ms, targetChannel?.id || null, interaction.user.id, guild, client);

      if (!result.success) {
        return interaction.reply({ content: result.error || 'Failed to activate user auto-delete.', ephemeral: true });
      }

      const scopeNote = targetChannel ? `in <#${targetChannel.id}>` : 'across **all channels in the server**';

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(COLORS.ERROR)
            .setTitle('🔇 User Auto-Delete (Shadow-Mute) Activated')
            .setDescription(
              `All incoming messages from <@${targetUser.id}> ${scopeNote} will be automatically shredded and deleted instantly for **${result.formattedDuration}**!\n\n` +
              `• **Target Member:** <@${targetUser.id}> (\`${targetUser.id}\`)\n` +
              `• **Scope:** ${targetChannel ? `<#${targetChannel.id}> only` : 'Global Server-Wide'}\n` +
              `• **Duration:** ${result.formattedDuration}\n` +
              `• **Stop Command:** \`/autodelete stop target:User user:@${targetUser.username}\``
            )
            .setFooter({ text: `Activated by ${interaction.user.username}` })
            .setTimestamp()
        ]
      });
    }

    // 3. STOP AUTO-DELETE
    if (sub === 'stop') {
      const targetType = interaction.options.getString('target');

      if (targetType === 'all') {
        await autoDeleteService.clearAll(guild.id);
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.SUCCESS)
              .setTitle('🧹 All Auto-Deletions Cleared')
              .setDescription('Successfully cancelled all active channel and user auto-deletions on this server.')
              .setTimestamp()
          ]
        });
      }

      if (targetType === 'channel') {
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        await autoDeleteService.removeChannelRule(guild.id, targetChannel.id);
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.SUCCESS)
              .setTitle('🔓 Channel Auto-Delete Stopped')
              .setDescription(`Auto-deletion has been stopped for <#${targetChannel.id}>.`)
              .setTimestamp()
          ]
        });
      }

      if (targetType === 'user') {
        const targetUser = interaction.options.getUser('user');
        if (!targetUser) {
          return interaction.reply({ content: '❌ Please specify the user to stop auto-deletion for.', ephemeral: true });
        }
        await autoDeleteService.removeUserRule(guild.id, targetUser.id);
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.SUCCESS)
              .setTitle('🔓 User Auto-Delete Stopped')
              .setDescription(`Auto-deletion has been stopped for <@${targetUser.id}>.`)
              .setTimestamp()
          ]
        });
      }
    }

    // 4. LIST ACTIVE RULES
    if (sub === 'list') {
      const active = autoDeleteService.getActiveRules(guild.id);

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`⏳ Active Auto-Deletions — ${guild.name}`)
        .setDescription(
          `Shows all channels and users currently undergoing automated message deletion.\n\n` +
          `**📢 Active Channel Auto-Deletions:**\n` +
          (active.channels.length > 0
            ? active.channels.map(c =>
                `• <#${c.channelId}> — Time Remaining: **${c.timeRemaining}** ${c.delaySeconds > 0 ? `*(Delay: ${c.delaySeconds}s)*` : '*(Instant)*'}`
              ).join('\n')
            : '*No channels currently set for auto-deletion.*') +
          `\n\n**👤 Active User Auto-Deletions (Shadow-Mutes):**\n` +
          (active.users.length > 0
            ? active.users.map(u =>
                `• <@${u.userId}> — Time Remaining: **${u.timeRemaining}** ${u.channelId ? `*(Only in <#${u.channelId}>)*` : '*(Server-wide)*'}`
              ).join('\n')
            : '*No users currently set for auto-deletion.*')
        )
        .setFooter({ text: 'AURA Auto-Delete System' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  },

  async executePrefix(message, args, client, settings) {
    const guild = message.guild;
    const caller = message.member || message.author;
    const invoked = message.content.slice(1).trim().split(/ +/)[0]?.toLowerCase();

    if (!isOwnerOrAdmin(caller, guild, client, settings)) {
      return message.reply('🚫 The `+autodelete` command can only be used by the **Bot Developer**, **Server Owner**, and **Administrators**.');
    }

    // Direct alias handling:
    // +shadowmute @user <duration>
    if (invoked === 'shadowmute' || invoked === 'shred') {
      let targetUser = message.mentions.users.first();
      let durationIndex = 1;
      if (!targetUser && args[0]) {
        const rawId = args[0].replace(/[<@!>]/g, '');
        targetUser = await client.users.fetch(rawId).catch(() => null);
        durationIndex = 1;
      }
      if (!targetUser) {
        return message.reply('❌ Usage: `+shadowmute @user <duration>` (e.g. `+shadowmute @user 15m`)');
      }

      const durationStr = args[durationIndex] || '10m';
      const parsed = autoDeleteService.parseDuration(durationStr);
      if (!parsed) {
        return message.reply('❌ Invalid duration format! Use e.g. `30s`, `10m`, `1h`, `2d`, or `stop`.');
      }

      if (parsed.stop) {
        await autoDeleteService.removeUserRule(guild.id, targetUser.id);
        return message.reply(`🔓 Auto-deletion stopped for <@${targetUser.id}>.`);
      }

      const result = await autoDeleteService.setUserRule(guild.id, targetUser.id, parsed.ms, null, message.author.id, guild, client);
      if (!result.success) return message.reply(result.error);

      return message.reply(`🔇 **User Auto-Delete (Shadow-Mute) Activated**: All messages from <@${targetUser.id}> will be automatically deleted for **${result.formattedDuration}**!`);
    }

    // +unshadowmute @user
    if (invoked === 'unshadowmute') {
      const targetUser = message.mentions.users.first() || (args[0] ? await client.users.fetch(args[0].replace(/[<@!>]/g, '')).catch(() => null) : null);
      if (!targetUser) return message.reply('❌ Usage: `+unshadowmute @user`');
      await autoDeleteService.removeUserRule(guild.id, targetUser.id);
      return message.reply(`🔓 Auto-deletion stopped for <@${targetUser.id}>.`);
    }

    // +silence [#channel] <duration>
    if (invoked === 'silence') {
      const targetChannel = message.mentions.channels.first() || message.channel;
      const durationStr = args.find(a => !a.startsWith('<#')) || '10m';
      const parsed = autoDeleteService.parseDuration(durationStr);
      if (!parsed) return message.reply('❌ Invalid duration format! Use e.g. `30s`, `10m`, `1h`, `2d`, or `stop`.');

      if (parsed.stop) {
        await autoDeleteService.removeChannelRule(guild.id, targetChannel.id);
        return message.reply(`🔓 Auto-deletion stopped for <#${targetChannel.id}>.`);
      }

      const result = await autoDeleteService.setChannelRule(guild.id, targetChannel.id, parsed.ms, 0, message.author.id);
      return message.reply(`⏳ **Channel Auto-Delete Activated**: Incoming messages in <#${targetChannel.id}> will be deleted automatically for **${result.formattedDuration}**!`);
    }

    // +unsilence [#channel]
    if (invoked === 'unsilence') {
      const targetChannel = message.mentions.channels.first() || message.channel;
      await autoDeleteService.removeChannelRule(guild.id, targetChannel.id);
      return message.reply(`🔓 Auto-deletion stopped for <#${targetChannel.id}>.`);
    }

    // Main command: +autodelete [channel|user|list|stop|clear]
    const action = args[0]?.toLowerCase();

    if (!action || action === 'list') {
      const active = autoDeleteService.getActiveRules(guild.id);
      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`⏳ Active Auto-Deletions — ${guild.name}`)
        .setDescription(
          `Shows all channels and users currently undergoing automated message deletion.\n\n` +
          `**📢 Active Channel Auto-Deletions:**\n` +
          (active.channels.length > 0
            ? active.channels.map(c => `• <#${c.channelId}> — Time Remaining: **${c.timeRemaining}** ${c.delaySeconds > 0 ? `*(Delay: ${c.delaySeconds}s)*` : '*(Instant)*'}`).join('\n')
            : '*No channels currently set for auto-deletion.*') +
          `\n\n**👤 Active User Auto-Deletions (Shadow-Mutes):**\n` +
          (active.users.length > 0
            ? active.users.map(u => `• <@${u.userId}> — Time Remaining: **${u.timeRemaining}** ${u.channelId ? `*(Only in <#${u.channelId}>)*` : '*(Server-wide)*'}`).join('\n')
            : '*No users currently set for auto-deletion.*')
        )
        .setFooter({ text: 'AURA Auto-Delete System • Use +autodelete channel or +autodelete user' })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // +autodelete channel [#channel] <duration> [delay]
    if (action === 'channel') {
      const targetChannel = message.mentions.channels.first() || message.channel;
      const nonChannelArgs = args.slice(1).filter(a => !a.startsWith('<#'));
      const durationStr = nonChannelArgs[0] || '10m';
      const delay = parseInt(nonChannelArgs[1], 10) || 0;

      const parsed = autoDeleteService.parseDuration(durationStr);
      if (!parsed) {
        return message.reply('❌ Invalid duration format! Use e.g. `+autodelete channel 10m` or `+autodelete channel #General 1h`.');
      }

      if (parsed.stop) {
        await autoDeleteService.removeChannelRule(guild.id, targetChannel.id);
        return message.reply(`🔓 Auto-deletion stopped for <#${targetChannel.id}>.`);
      }

      const result = await autoDeleteService.setChannelRule(guild.id, targetChannel.id, parsed.ms, delay, message.author.id);
      return message.reply(`⏳ **Channel Auto-Delete Activated**: All incoming messages in <#${targetChannel.id}> will be automatically deleted for **${result.formattedDuration}**${delay > 0 ? ` after ${delay}s` : ' instantly'}!`);
    }

    // +autodelete user @user <duration>
    if (action === 'user' || action === 'member') {
      let targetUser = message.mentions.users.first();
      let durationStr = args[2];

      if (!targetUser && args[1]) {
        const rawId = args[1].replace(/[<@!>]/g, '');
        targetUser = await client.users.fetch(rawId).catch(() => null);
        durationStr = args[2];
      }

      if (!targetUser) {
        return message.reply('❌ Usage: `+autodelete user @user <duration>`\n• Example: `+autodelete user @spammer 15m`');
      }

      if (targetUser.id === client.user.id) {
        return message.reply('❌ I cannot apply auto-delete to myself!');
      }

      const parsed = autoDeleteService.parseDuration(durationStr || '10m');
      if (!parsed) {
        return message.reply('❌ Invalid duration format! Use e.g. `30s`, `10m`, `1h`, `2d`, or `stop`.');
      }

      if (parsed.stop) {
        await autoDeleteService.removeUserRule(guild.id, targetUser.id);
        return message.reply(`🔓 Auto-deletion stopped for <@${targetUser.id}>.`);
      }

      const result = await autoDeleteService.setUserRule(guild.id, targetUser.id, parsed.ms, null, message.author.id, guild, client);
      if (!result.success) return message.reply(result.error);

      return message.reply(`🔇 **User Auto-Delete (Shadow-Mute) Activated**: All messages from <@${targetUser.id}> will be automatically shredded for **${result.formattedDuration}**!`);
    }

    // +autodelete stop [channel|user|all]
    if (action === 'stop' || action === 'clear' || action === 'cancel') {
      const targetType = args[1]?.toLowerCase() || 'all';

      if (targetType === 'all') {
        await autoDeleteService.clearAll(guild.id);
        return message.reply('🧹 Cleared all active channel and user auto-deletions on this server.');
      }

      if (targetType === 'channel') {
        const targetChannel = message.mentions.channels.first() || message.channel;
        await autoDeleteService.removeChannelRule(guild.id, targetChannel.id);
        return message.reply(`🔓 Auto-deletion stopped for <#${targetChannel.id}>.`);
      }

      if (targetType === 'user') {
        const targetUser = message.mentions.users.first() || (args[2] ? await client.users.fetch(args[2].replace(/[<@!>]/g, '')).catch(() => null) : null);
        if (!targetUser) return message.reply('❌ Usage: `+autodelete stop user @user`');
        await autoDeleteService.removeUserRule(guild.id, targetUser.id);
        return message.reply(`🔓 Auto-deletion stopped for <@${targetUser.id}>.`);
      }
    }

    return message.reply(
      '❓ **Auto-Delete Usage Guide:**\n' +
      '• `+autodelete channel [#channel] <duration>` — Delete incoming messages in a channel (e.g. `+autodelete channel 15m`)\n' +
      '• `+autodelete user @user <duration>` — Automatically shred messages from a user (e.g. `+autodelete user @spammer 10m`)\n' +
      '• `+autodelete list` — View all active auto-deletions with timers\n' +
      '• `+autodelete stop [channel|user|all]` — Cancel auto-deletion\n' +
      '• **Quick Shortcuts:** `+shadowmute @user 10m` • `+unshadowmute @user` • `+silence 15m` • `+unsilence`'
    );
  }
};
