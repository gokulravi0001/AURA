const {
  SlashCommandBuilder,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder
} = require('discord.js');
const TempVoice = require('../../../models/TempVoice');
const Guild = require('../../../models/Guild');
const guildService = require('../../../shared/guildService');
const { COLORS } = require('../../../shared/constants');
const { isOwnerOrAdmin } = require('../../../shared/permissionHelper');
const bounceManager = require('../../modules/bounceManager');
const immunityService = require('../../../shared/immunityService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vc')
    .setDescription('Manage your temporary voice lounge or setup Join-to-Create')
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Create Join-to-Create trigger channel and category automatically (Admin only)')
        .addStringOption(opt => opt.setName('format').setDescription('Naming format (e.g. 🔊 {username}\'s Lounge)'))
    )
    .addSubcommand(sub =>
      sub.setName('lock')
        .setDescription('Lock your voice channel from new members')
    )
    .addSubcommand(sub =>
      sub.setName('unlock')
        .setDescription('Unlock your voice channel')
    )
    .addSubcommand(sub =>
      sub.setName('hide')
        .setDescription('Hide your voice channel from @everyone')
    )
    .addSubcommand(sub =>
      sub.setName('show')
        .setDescription('Make your voice channel visible to @everyone')
    )
    .addSubcommand(sub =>
      sub.setName('limit')
        .setDescription('Set user limit for your channel')
        .addIntegerOption(opt => opt.setName('count').setDescription('Max users (0 for unlimited)').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('name')
        .setDescription('Rename your voice channel')
        .addStringOption(opt => opt.setName('name').setDescription('New channel name').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('give')
        .setDescription('Transfer ownership of your channel to another member in the lounge')
        .addUserOption(opt => opt.setName('target').setDescription('Member to transfer ownership to').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('panel')
        .setDescription('Send the interactive customization control panel into your voice channel')
    )
    .addSubcommand(sub =>
      sub.setName('move')
        .setDescription('Mass move all members from one voice channel to another (Owner & Admin only)')
        .addChannelOption(opt =>
          opt.setName('to')
            .setDescription('Destination voice channel')
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('from')
            .setDescription('Source voice channel (defaults to your current voice channel)')
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        )
    )
    .addSubcommand(sub =>
      sub.setName('disconnect')
        .setDescription('Mass disconnect all members from a voice channel (Owner & Admin only)')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Voice channel to disconnect members from (defaults to your current voice channel)')
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        )
    )
    .addSubcommand(sub =>
      sub.setName('mute')
        .setDescription('Mass server-mute all members in a voice channel (Owner & Admin only)')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Voice channel to mute members in (defaults to your current voice channel)')
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        )
    )
    .addSubcommand(sub =>
      sub.setName('unmute')
        .setDescription('Mass server-unmute all members in a voice channel (Owner & Admin only)')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Voice channel to unmute members in (defaults to your current voice channel)')
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        )
    )
    .addSubcommand(sub =>
      sub.setName('bounce')
        .setDescription('Move a member across all voice channels one by one in a few seconds (Owner & Admin only)')
        .addUserOption(opt =>
          opt.setName('target')
            .setDescription('Member to move across voice channels')
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
        )
    ),
  name: 'vc',
  description: 'Manage temporary voice channels or setup Join-to-Create',
  aliases: [
    'voice', 'tempvoice',
    'massmove', 'movevc',
    'massdc', 'massdisconnect', 'vcdc', 'disconnectvc',
    'massmute', 'massunmute', 'vcmute', 'vcunmute', 'mutevc', 'unmutevc',
    'bounce', 'vcbounce', 'orbit', 'vcorbit', 'tour', 'vctour', 'drag', 'vcdrag'
  ],
  module: 'join_to_create',

  async execute(interaction, client, settings) {
    const sub = interaction.options.getSubcommand();

    // 1. SETUP COMMAND (Admin only)
    if (sub === 'setup') {
      if (!isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client)) {
        return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
      }

      await interaction.deferReply();
      try {
        const format = interaction.options.getString('format') || "🔊 {username}'s Lounge";
        const guild = interaction.guild;

        // Clean up previous empty Join-to-Create setup if any exists to avoid duplicate categories
        const existingSettings = await guildService.getSettings(guild.id);
        if (existingSettings?.joinToCreate?.categoryId) {
          const oldCat = guild.channels.cache.get(existingSettings.joinToCreate.categoryId);
          if (oldCat) {
            const oldChildren = guild.channels.cache.filter(c => c.parentId === oldCat.id);
            for (const ch of oldChildren.values()) {
              if (ch.members.size === 0) await ch.delete().catch(() => {});
            }
            if (oldCat.children?.cache?.size === 0) await oldCat.delete().catch(() => {});
          }
        }

        const category = await guild.channels.create({
          name: '🔊 VOICE LOUNGES',
          type: ChannelType.GuildCategory
        });

        const trigger = await guild.channels.create({
          name: '➕ Join to Create',
          type: ChannelType.GuildVoice,
          parent: category.id,
          userLimit: 1
        });

        // Update settings in DB and immediately refresh the in-memory cache
        await guildService.updateSettings(guild.id, {
          'modules.join_to_create': true,
          'joinToCreate.enabled': true,
          'joinToCreate.channelId': trigger.id,
          'joinToCreate.categoryId': category.id,
          'joinToCreate.channelNameFormat': format
        });

        // Check if bot has MoveMembers permission
        const botMember = await guild.members.fetchMe().catch(() => null);
        const hasMoveMembers = botMember?.permissions.has(PermissionsBitField.Flags.MoveMembers);
        const movePermNotice = hasMoveMembers ? '' : '\n\n⚠️ **Warning:** The bot role is missing the **Move Members** permission in server settings! Please enable **Move Members** for the bot role so it can automatically move members into their newly created rooms.';

        return interaction.followUp({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.SUCCESS)
              .setTitle('🎉 Join-to-Create Voice Setup Complete!')
              .setDescription(`Created category **${category.name}** and trigger channel <#${trigger.id}>.\nWhen members click <#${trigger.id}>, AURA will immediately create a private temporary voice room and move them into it!${movePermNotice}`)
          ]
        });
      } catch (err) {
        return interaction.followUp(`❌ Failed to create channels: ${err.message}`);
      }
    }

    // 2. MASS MOVE COMMAND (Owner, Admin, and Bot Developer only)
    if (sub === 'move') {
      if (!isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client)) {
        return interaction.reply({ content: '🚫 The `/vc move` command can only be used by the **Bot Developer**, **Server Owner**, and **Administrators**.', ephemeral: true });
      }

      const guild = interaction.guild;
      const botMember = await guild.members.fetchMe().catch(() => null);
      if (!botMember?.permissions.has(PermissionsBitField.Flags.MoveMembers) &&
          !botMember?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: '🚫 I do not have the **Move Members** permission in this server to move members.', ephemeral: true });
      }

      const targetChannel = interaction.options.getChannel('to');
      let sourceChannel = interaction.options.getChannel('from');

      if (!sourceChannel) {
        sourceChannel = interaction.member.voice?.channel;
        if (!sourceChannel) {
          return interaction.reply({
            content: '❌ Please specify the source voice channel (`from`) or join a voice channel first!',
            ephemeral: true
          });
        }
      }

      if (!targetChannel.isVoiceBased()) {
        return interaction.reply({ content: '❌ The destination channel must be a voice or stage channel!', ephemeral: true });
      }

      if (!sourceChannel.isVoiceBased()) {
        return interaction.reply({ content: '❌ The source channel must be a voice or stage channel!', ephemeral: true });
      }

      if (sourceChannel.id === targetChannel.id) {
        return interaction.reply({ content: '❌ The source and destination voice channels cannot be the same!', ephemeral: true });
      }

      const allSourceMembers = [...sourceChannel.members.values()];
      if (allSourceMembers.length === 0) {
        return interaction.reply({ content: `⚠️ No members are currently connected to <#${sourceChannel.id}>.`, ephemeral: true });
      }

      const immuneMoveCount = allSourceMembers.filter(m => immunityService.isImmune(m, guild, client, settings)).length;
      const membersToMove = allSourceMembers.filter(m => !immunityService.isImmune(m, guild, client, settings));

      if (membersToMove.length === 0 && immuneMoveCount > 0) {
        return interaction.reply({
          content: `🛡️ All connected members in <#${sourceChannel.id}> possess **Immunity** and cannot be moved (even by the Server Owner).`,
          ephemeral: true
        });
      }

      await interaction.deferReply();

      let successCount = 0;
      let failCount = 0;

      for (const m of membersToMove) {
        try {
          await m.voice.setChannel(targetChannel.id);
          successCount++;
        } catch (_) {
          failCount++;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('🚚 Mass Move Completed!')
        .setDescription(
          `Successfully moved **${successCount}** member${successCount === 1 ? '' : 's'} from <#${sourceChannel.id}> to <#${targetChannel.id}>!` +
          (immuneMoveCount > 0 ? `\n🛡️ *${immuneMoveCount} immune member(s) were protected and skipped.*` : '') +
          (failCount > 0 ? `\n⚠️ *${failCount} member(s) could not be moved (missing permissions or disconnected).*` : '')
        )
        .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      return interaction.followUp({ embeds: [embed] });
    }

    // 3. MASS DISCONNECT COMMAND (Owner, Admin, and Bot Developer only)
    if (sub === 'disconnect') {
      if (!isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client)) {
        return interaction.reply({ content: '🚫 The `/vc disconnect` command can only be used by the **Bot Developer**, **Server Owner**, and **Administrators**.', ephemeral: true });
      }

      const guild = interaction.guild;
      const botMember = await guild.members.fetchMe().catch(() => null);
      if (!botMember?.permissions.has(PermissionsBitField.Flags.MoveMembers) &&
          !botMember?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: '🚫 I do not have the **Move Members** permission in this server to disconnect members.', ephemeral: true });
      }

      let targetChannel = interaction.options.getChannel('channel');

      if (!targetChannel) {
        targetChannel = interaction.member.voice?.channel;
        if (!targetChannel) {
          return interaction.reply({
            content: '❌ Please specify the voice channel (`channel`) or join a voice channel first!',
            ephemeral: true
          });
        }
      }

      if (!targetChannel.isVoiceBased()) {
        return interaction.reply({ content: '❌ The selected channel must be a voice or stage channel!', ephemeral: true });
      }

      const allChannelMembers = [...targetChannel.members.values()];
      if (allChannelMembers.length === 0) {
        return interaction.reply({ content: `⚠️ No members are currently connected to <#${targetChannel.id}>.`, ephemeral: true });
      }

      const immuneCount = allChannelMembers.filter(m => immunityService.isImmune(m, guild, client, settings)).length;
      const membersToDisconnect = allChannelMembers.filter(m => !immunityService.isImmune(m, guild, client, settings));

      if (membersToDisconnect.length === 0 && immuneCount > 0) {
        return interaction.reply({
          content: `🛡️ All connected members in <#${targetChannel.id}> possess **Immunity** and cannot be disconnected.`,
          ephemeral: true
        });
      }

      await interaction.deferReply();

      let successCount = 0;
      let failCount = 0;

      for (const m of membersToDisconnect) {
        try {
          await m.voice.disconnect();
          successCount++;
        } catch (_) {
          failCount++;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle('🔌 Mass Disconnect Completed!')
        .setDescription(
          `Successfully disconnected **${successCount}** member${successCount === 1 ? '' : 's'} from <#${targetChannel.id}>!` +
          (immuneCount > 0 ? `\n🛡️ *${immuneCount} immune member(s) were protected and skipped.*` : '') +
          (failCount > 0 ? `\n⚠️ *${failCount} member(s) could not be disconnected (missing permissions or already left).*` : '')
        )
        .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      return interaction.followUp({ embeds: [embed] });
    }

    // 4. MASS MUTE & UNMUTE COMMAND (Owner, Admin, and Bot Developer only)
    if (sub === 'mute' || sub === 'unmute') {
      const isMute = sub === 'mute';
      if (!isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client)) {
        return interaction.reply({
          content: `🚫 The \`/vc ${isMute ? 'mute' : 'unmute'}\` command can only be used by the **Bot Developer**, **Server Owner**, and **Administrators**.`,
          ephemeral: true
        });
      }

      const guild = interaction.guild;
      const botMember = await guild.members.fetchMe().catch(() => null);
      if (!botMember?.permissions.has(PermissionsBitField.Flags.MuteMembers) &&
          !botMember?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({
          content: `🚫 I do not have the **Mute Members** permission in this server to ${isMute ? 'mute' : 'unmute'} members.`,
          ephemeral: true
        });
      }

      let targetChannel = interaction.options.getChannel('channel');

      if (!targetChannel) {
        targetChannel = interaction.member.voice?.channel;
        if (!targetChannel) {
          return interaction.reply({
            content: `❌ Please specify the voice channel (\`channel\`) or join a voice channel first!`,
            ephemeral: true
          });
        }
      }

      if (!targetChannel.isVoiceBased()) {
        return interaction.reply({ content: '❌ The selected channel must be a voice or stage channel!', ephemeral: true });
      }

      const channelMembers = [...targetChannel.members.values()];
      if (channelMembers.length === 0) {
        return interaction.reply({ content: `⚠️ No members are currently connected to <#${targetChannel.id}>.`, ephemeral: true });
      }

      const immuneMuteCount = isMute ? channelMembers.filter(m => immunityService.isImmune(m, guild, client, settings)).length : 0;
      const membersToProcess = channelMembers.filter(m => {
        if (m.id === client.user.id) return false;
        if (isMute && immunityService.isImmune(m, guild, client, settings)) return false;
        return isMute ? !m.voice.serverMute : m.voice.serverMute;
      });

      if (membersToProcess.length === 0) {
        if (isMute && immuneMuteCount > 0) {
          return interaction.reply({
            content: `🛡️ All unmuted members in <#${targetChannel.id}> possess **Immunity** and cannot be server muted.`,
            ephemeral: true
          });
        }
        return interaction.reply({
          content: `⚠️ All members in <#${targetChannel.id}> are already ${isMute ? 'server muted' : 'server unmuted'}.`,
          ephemeral: true
        });
      }

      await interaction.deferReply();

      let successCount = 0;
      let failCount = 0;

      for (const m of membersToProcess) {
        try {
          await m.voice.setMute(isMute, `Mass ${isMute ? 'mute' : 'unmute'} by ${interaction.user.tag}`);
          successCount++;
        } catch (_) {
          failCount++;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(isMute ? COLORS.WARNING : COLORS.SUCCESS)
        .setTitle(isMute ? '🔇 Mass Server Mute Completed!' : '🔊 Mass Server Unmute Completed!')
        .setDescription(
          `Successfully ${isMute ? 'server muted' : 'server unmuted'} **${successCount}** member${successCount === 1 ? '' : 's'} in <#${targetChannel.id}>!` +
          (immuneMuteCount > 0 ? `\n🛡️ *${immuneMuteCount} immune member(s) were protected and skipped.*` : '') +
          (failCount > 0 ? `\n⚠️ *${failCount} member(s) could not be ${isMute ? 'muted' : 'unmuted'} (missing permissions or higher role).*` : '')
        )
        .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      return interaction.followUp({ embeds: [embed] });
    }

    // 5. BOUNCE COMMAND (Owner, Admin, and Bot Developer only)
    if (sub === 'bounce') {
      if (!isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client)) {
        return interaction.reply({ content: '🚫 The `/vc bounce` command can only be used by the **Bot Developer**, **Server Owner**, and **Administrators**.', ephemeral: true });
      }

      const guild = interaction.guild;
      const botMember = await guild.members.fetchMe().catch(() => null);
      if (!botMember?.permissions.has(PermissionsBitField.Flags.MoveMembers) &&
          !botMember?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: '🚫 I do not have the **Move Members** permission in this server to bounce members.', ephemeral: true });
      }

      const targetUser = interaction.options.getUser('target');
      let targetMember = interaction.options.getMember('target');
      const targetId = targetMember?.id || targetUser?.id;

      if (targetId && immunityService.isImmune(targetId, guild, client, settings)) {
        return interaction.reply({
          content: `🛡️ **Immunity Protected**: <@${targetId}> possesses **Immunity** and cannot be targeted by the voice bounce command (even by the Server Owner).`,
          ephemeral: true
        });
      }

      if (!targetMember && targetUser) {
        targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      }

      if (!targetMember) {
        return interaction.reply({ content: '❌ Target member not found in this server.', ephemeral: true });
      }

      // Stop option: /vc bounce target:@user stop:true
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
        return interaction.reply({ content: `⚠️ <@${targetMember.id}> is already in an active voice bounce tour. Use \`/vc bounce target:@member stop:true\` to stop it.`, ephemeral: true });
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
    }
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: '❌ You must be connected to your temporary voice channel to use this command.', ephemeral: true });
    }

    const tempDoc = await TempVoice.findOne({ channelId: voiceChannel.id });
    if (!tempDoc) {
      return interaction.reply({ content: '❌ This channel is not a bot-managed temporary channel.', ephemeral: true });
    }

    const isOwner = tempDoc.ownerId === interaction.user.id;
    const isAdmin = isOwnerOrAdmin(interaction.member || interaction.user, interaction.guild, client);

    if (!isOwner && !isAdmin) {
      return interaction.reply({ content: '🚫 Only the channel creator or an administrator can manage this voice lounge.', ephemeral: true });
    }

    // PANEL
    if (sub === 'panel') {
      const voiceManager = require('../../modules/voiceManager');
      const panelData = voiceManager.buildControlPanel(voiceChannel, interaction.member);
      await voiceChannel.send({
        content: `👋 <@${interaction.user.id}>, here is your voice channel control panel:`,
        embeds: panelData.embeds,
        components: panelData.components
      });
      return interaction.reply({ content: '✅ Voice control panel posted in your channel!', ephemeral: true });
    }

    // LOCK
    if (sub === 'lock') {
      await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
      tempDoc.isLocked = true;
      await tempDoc.save();
      return interaction.reply({ content: '🔒 Voice channel **locked**! Nobody else can connect.', ephemeral: true });
    }

    // UNLOCK
    if (sub === 'unlock') {
      await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: true });
      tempDoc.isLocked = false;
      await tempDoc.save();
      return interaction.reply({ content: '🔓 Voice channel **unlocked**! Members can connect.', ephemeral: true });
    }

    // HIDE
    if (sub === 'hide') {
      await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
      tempDoc.isHidden = true;
      await tempDoc.save();
      return interaction.reply({ content: '👻 Voice channel **hidden** from @everyone.', ephemeral: true });
    }

    // SHOW
    if (sub === 'show') {
      await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: true });
      tempDoc.isHidden = false;
      await tempDoc.save();
      return interaction.reply({ content: '👁️ Voice channel is now **visible** to @everyone.', ephemeral: true });
    }

    // LIMIT
    if (sub === 'limit') {
      const count = interaction.options.getInteger('count');
      if (count < 0 || count > 99) return interaction.reply({ content: '❌ Limit must be between 0 and 99.', ephemeral: true });
      await voiceChannel.setUserLimit(count);
      return interaction.reply({ content: `👥 User limit set to **${count === 0 ? 'unlimited' : count}**.`, ephemeral: true });
    }

    // NAME
    if (sub === 'name' || sub === 'rename') {
      const newName = interaction.options.getString('name').substring(0, 100);
      await voiceChannel.setName(newName);
      return interaction.reply({ content: `✏️ Channel renamed to **"${newName}"**.`, ephemeral: true });
    }

    // GIVE (transfer)
    if (sub === 'give' || sub === 'transfer') {
      const targetUser = interaction.options.getUser('target');
      if (targetUser.id === interaction.user.id) {
        return interaction.reply({ content: '❌ You already own this channel.', ephemeral: true });
      }

      const targetMember = interaction.guild.members.cache.get(targetUser.id);
      if (!targetMember || targetMember.voice.channelId !== voiceChannel.id) {
        return interaction.reply({ content: '❌ The target member must be inside this voice channel with you.', ephemeral: true });
      }

      tempDoc.ownerId = targetUser.id;
      await tempDoc.save();

      await voiceChannel.permissionOverwrites.edit(targetUser.id, {
        ManageChannels: true,
        MoveMembers: true,
        Connect: true,
        Speak: true
      });

      return interaction.reply({ content: `👑 Transferred channel ownership to <@${targetUser.id}>!` });
    }
  },

  async executePrefix(message, args, client, settings) {
    const action = args[0]?.toLowerCase();

    // +vc setup
    if (action === 'setup') {
      if (!isOwnerOrAdmin(message.member || message.author, message.guild, client)) {
        return message.reply('🚫 Administrator permission required.');
      }

      const guild = message.guild;

      // Clean up previous empty Join-to-Create setup if any exists
      const existingSettings = await guildService.getSettings(guild.id);
      if (existingSettings?.joinToCreate?.categoryId) {
        const oldCat = guild.channels.cache.get(existingSettings.joinToCreate.categoryId);
        if (oldCat) {
          const oldChildren = guild.channels.cache.filter(c => c.parentId === oldCat.id);
          for (const ch of oldChildren.values()) {
            if (ch.members.size === 0) await ch.delete().catch(() => {});
          }
          if (oldCat.children?.cache?.size === 0) await oldCat.delete().catch(() => {});
        }
      }

      const category = await guild.channels.create({
        name: '🔊 VOICE LOUNGES',
        type: ChannelType.GuildCategory
      });

      const trigger = await guild.channels.create({
        name: '➕ Join to Create',
        type: ChannelType.GuildVoice,
        parent: category.id,
        userLimit: 1
      });

      // Update settings in DB and immediately refresh the in-memory cache
      await guildService.updateSettings(guild.id, {
        'modules.join_to_create': true,
        'joinToCreate.enabled': true,
        'joinToCreate.channelId': trigger.id,
        'joinToCreate.categoryId': category.id,
        'joinToCreate.channelNameFormat': "🔊 {username}'s Lounge"
      });

      // Check if bot has MoveMembers permission
      const botMember = await guild.members.fetchMe().catch(() => null);
      const hasMoveMembers = botMember?.permissions.has(PermissionsBitField.Flags.MoveMembers);
      const movePermNotice = hasMoveMembers ? '' : '\n\n⚠️ **Warning:** The bot role is missing the **Move Members** permission in server settings! Please enable **Move Members** for the bot role so it can automatically move members into their newly created rooms.';

      return message.reply(`🎉 Join-to-Create Voice setup complete! Category: **${category.name}**, Trigger: <#${trigger.id}>.${movePermNotice}`);
    }

    // +vc move <#to> [#from] OR +massmove <#to> [#from]
    const prefix = settings?.prefix || '+';
    const invokedCommand = message.content.slice(prefix.length).trim().split(/ +/)[0]?.toLowerCase();
    const isMoveAction = action === 'move' || action === 'massmove' || invokedCommand === 'massmove' || invokedCommand === 'movevc';

    if (isMoveAction) {
      if (!isOwnerOrAdmin(message.member || message.author, message.guild, client)) {
        return message.reply('🚫 The `+vc move` command can only be used by the **Bot Developer**, **Server Owner**, and **Administrators**.');
      }

      const guild = message.guild;
      const botMember = await guild.members.fetchMe().catch(() => null);
      if (!botMember?.permissions.has(PermissionsBitField.Flags.MoveMembers) &&
          !botMember?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('🚫 I do not have the **Move Members** permission in this server to move members.');
      }

      // If invoked as +vc move <#to> [#from], skip the action word 'move'/'massmove'
      const targetArgs = (action === 'move' || action === 'massmove') ? args.slice(1) : args;
      const mentionedChannels = [...message.mentions.channels.values()].filter(c => c.isVoiceBased());

      let targetChannel = null;
      let sourceChannel = null;

      if (mentionedChannels.length >= 2) {
        targetChannel = mentionedChannels[0];
        sourceChannel = mentionedChannels[1];
      } else if (mentionedChannels.length === 1) {
        targetChannel = mentionedChannels[0];
        if (targetArgs[1]) {
          const rawId = targetArgs[1].replace(/[<#>]/g, '');
          sourceChannel = guild.channels.cache.get(rawId) || guild.channels.cache.find(c => c.isVoiceBased() && c.name.toLowerCase() === targetArgs[1].toLowerCase());
        }
      } else {
        if (targetArgs[0]) {
          const rawId1 = targetArgs[0].replace(/[<#>]/g, '');
          targetChannel = guild.channels.cache.get(rawId1) || guild.channels.cache.find(c => c.isVoiceBased() && c.name.toLowerCase() === targetArgs[0].toLowerCase());
        }
        if (targetArgs[1]) {
          const rawId2 = targetArgs[1].replace(/[<#>]/g, '');
          sourceChannel = guild.channels.cache.get(rawId2) || guild.channels.cache.find(c => c.isVoiceBased() && c.name.toLowerCase() === targetArgs[1].toLowerCase());
        }
      }

      // If sourceChannel is still not specified, default to the channel the user is currently in
      if (!sourceChannel) {
        sourceChannel = message.member.voice?.channel;
      }

      if (!targetChannel || !targetChannel.isVoiceBased()) {
        return message.reply(
          '❌ Please specify the destination voice channel!\n' +
          '• **Usage:** `+vc move <#destination-vc> [#source-vc]`\n' +
          '• **Quick Move:** `+vc move #General` *(moves everyone from your current voice channel into General)*\n' +
          '• **Or:** `+massmove <#destination-vc> [#source-vc]`'
        );
      }

      if (!sourceChannel || !sourceChannel.isVoiceBased()) {
        return message.reply('❌ Please join a voice channel or specify the source channel to move from!\n• Example: `+vc move #TargetVC #SourceVC`');
      }

      if (sourceChannel.id === targetChannel.id) {
        return message.reply('❌ The source and destination voice channels cannot be the same!');
      }

      const allSourceMembers = [...sourceChannel.members.values()];
      if (allSourceMembers.length === 0) {
        return message.reply(`⚠️ No members are currently connected to <#${sourceChannel.id}>.`);
      }

      const immuneMoveCount = allSourceMembers.filter(m => immunityService.isImmune(m, guild, client, settings)).length;
      const membersToMove = allSourceMembers.filter(m => !immunityService.isImmune(m, guild, client, settings));

      if (membersToMove.length === 0 && immuneMoveCount > 0) {
        return message.reply(`🛡️ All connected members in <#${sourceChannel.id}> possess **Immunity** and cannot be moved (even by the Server Owner).`);
      }

      let successCount = 0;
      let failCount = 0;

      for (const m of membersToMove) {
        try {
          await m.voice.setChannel(targetChannel.id);
          successCount++;
        } catch (_) {
          failCount++;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle('🚚 Mass Move Completed!')
        .setDescription(
          `Successfully moved **${successCount}** member${successCount === 1 ? '' : 's'} from <#${sourceChannel.id}> to <#${targetChannel.id}>!` +
          (immuneMoveCount > 0 ? `\n🛡️ *${immuneMoveCount} immune member(s) were protected and skipped.*` : '') +
          (failCount > 0 ? `\n⚠️ *${failCount} member(s) could not be moved (missing permissions or disconnected).*` : '')
        )
        .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // +vc disconnect [#channel] OR +massdc [#channel] OR +vc massdc [#channel]
    const isDisconnectAction = action === 'disconnect' || action === 'massdc' || action === 'dc' || action === 'massdisconnect' ||
      invokedCommand === 'massdc' || invokedCommand === 'massdisconnect' || invokedCommand === 'vcdc' || invokedCommand === 'disconnectvc';

    if (isDisconnectAction) {
      if (!isOwnerOrAdmin(message.member || message.author, message.guild, client)) {
        return message.reply('🚫 The `+vc disconnect` command can only be used by the **Bot Developer**, **Server Owner**, and **Administrators**.');
      }

      const guild = message.guild;
      const botMember = await guild.members.fetchMe().catch(() => null);
      if (!botMember?.permissions.has(PermissionsBitField.Flags.MoveMembers) &&
          !botMember?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('🚫 I do not have the **Move Members** permission in this server to disconnect members.');
      }

      const isSubAction = (action === 'disconnect' || action === 'massdc' || action === 'dc' || action === 'massdisconnect');
      const targetArgs = isSubAction ? args.slice(1) : args;
      const mentionedVoiceChannel = [...message.mentions.channels.values()].find(c => c.isVoiceBased());

      let targetChannel = mentionedVoiceChannel;

      if (!targetChannel && targetArgs[0]) {
        const rawId = targetArgs[0].replace(/[<#>]/g, '');
        targetChannel = guild.channels.cache.get(rawId) || guild.channels.cache.find(c => c.isVoiceBased() && c.name.toLowerCase() === targetArgs[0].toLowerCase());
      }

      if (!targetChannel) {
        targetChannel = message.member.voice?.channel;
      }

      if (!targetChannel || !targetChannel.isVoiceBased()) {
        return message.reply(
          '❌ Please join a voice channel or specify the voice channel to disconnect members from!\n' +
          '• **Usage:** `+vc disconnect [#channel]`\n' +
          '• **Quick Disconnect:** `+massdc` *(disconnects everyone in your current VC)*\n' +
          '• **Or:** `+massdc #General` *(disconnects everyone in #General)*'
        );
      }

      const allMembers = [...targetChannel.members.values()];
      if (allMembers.length === 0) {
        return message.reply(`⚠️ No members are currently connected to <#${targetChannel.id}>.`);
      }

      const immuneCount = allMembers.filter(m => immunityService.isImmune(m, guild, client, settings)).length;
      const membersToDisconnect = allMembers.filter(m => !immunityService.isImmune(m, guild, client, settings));

      if (membersToDisconnect.length === 0 && immuneCount > 0) {
        return message.reply(`🛡️ All connected members in <#${targetChannel.id}> possess **Immunity** and cannot be disconnected.`);
      }

      let successCount = 0;
      let failCount = 0;

      for (const m of membersToDisconnect) {
        try {
          await m.voice.disconnect();
          successCount++;
        } catch (_) {
          failCount++;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle('🔌 Mass Disconnect Completed!')
        .setDescription(
          `Successfully disconnected **${successCount}** member${successCount === 1 ? '' : 's'} from <#${targetChannel.id}>!` +
          (immuneCount > 0 ? `\n🛡️ *${immuneCount} immune member(s) were protected and skipped.*` : '') +
          (failCount > 0 ? `\n⚠️ *${failCount} member(s) could not be disconnected (missing permissions or already left).*` : '')
        )
        .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // +vc mute [#channel] OR +massmute [#channel] OR +vc unmute [#channel] OR +massunmute [#channel]
    const isMuteAction = action === 'mute' || action === 'massmute' || action === 'servermute' ||
      invokedCommand === 'massmute' || invokedCommand === 'vcmute' || invokedCommand === 'mutevc';
    const isUnmuteAction = action === 'unmute' || action === 'massunmute' || action === 'serverunmute' ||
      invokedCommand === 'massunmute' || invokedCommand === 'vcunmute' || invokedCommand === 'unmutevc';

    if (isMuteAction || isUnmuteAction) {
      const isMute = isMuteAction;
      if (!isOwnerOrAdmin(message.member || message.author, message.guild, client)) {
        return message.reply(`🚫 The \`+vc ${isMute ? 'mute' : 'unmute'}\` command can only be used by the **Bot Developer**, **Server Owner**, and **Administrators**.`);
      }

      const guild = message.guild;
      const botMember = await guild.members.fetchMe().catch(() => null);
      if (!botMember?.permissions.has(PermissionsBitField.Flags.MuteMembers) &&
          !botMember?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply(`🚫 I do not have the **Mute Members** permission in this server to ${isMute ? 'mute' : 'unmute'} members.`);
      }

      const isSubAction = (action === 'mute' || action === 'unmute' || action === 'massmute' || action === 'massunmute' || action === 'servermute' || action === 'serverunmute');
      const targetArgs = isSubAction ? args.slice(1) : args;
      const mentionedVoiceChannel = [...message.mentions.channels.values()].find(c => c.isVoiceBased());

      let targetChannel = mentionedVoiceChannel;

      if (!targetChannel && targetArgs[0]) {
        const rawId = targetArgs[0].replace(/[<#>]/g, '');
        targetChannel = guild.channels.cache.get(rawId) || guild.channels.cache.find(c => c.isVoiceBased() && c.name.toLowerCase() === targetArgs[0].toLowerCase());
      }

      if (!targetChannel) {
        targetChannel = message.member.voice?.channel;
      }

      if (!targetChannel || !targetChannel.isVoiceBased()) {
        return message.reply(
          `❌ Please join a voice channel or specify the voice channel to ${isMute ? 'mute' : 'unmute'} members in!\n` +
          `• **Usage:** \`+vc ${isMute ? 'mute' : 'unmute'} [#channel]\`\n` +
          `• **Quick Action:** \`+mass${isMute ? 'mute' : 'unmute'}\` *(applies to your current VC)*\n` +
          `• **Or:** \`+mass${isMute ? 'mute' : 'unmute'} #General\``
        );
      }

      const channelMembers = [...targetChannel.members.values()];
      if (channelMembers.length === 0) {
        return message.reply(`⚠️ No members are currently connected to <#${targetChannel.id}>.`);
      }

      const immuneMuteCount = isMute ? channelMembers.filter(m => immunityService.isImmune(m, guild, client, settings)).length : 0;
      const membersToProcess = channelMembers.filter(m => {
        if (m.id === client.user.id) return false;
        if (isMute && immunityService.isImmune(m, guild, client, settings)) return false;
        return isMute ? !m.voice.serverMute : m.voice.serverMute;
      });

      if (membersToProcess.length === 0) {
        if (isMute && immuneMuteCount > 0) {
          return message.reply(`🛡️ All unmuted members in <#${targetChannel.id}> possess **Immunity** and cannot be server muted.`);
        }
        return message.reply(`⚠️ All members in <#${targetChannel.id}> are already ${isMute ? 'server muted' : 'server unmuted'}.`);
      }

      let successCount = 0;
      let failCount = 0;

      for (const m of membersToProcess) {
        try {
          await m.voice.setMute(isMute, `Mass ${isMute ? 'mute' : 'unmute'} by ${message.author.tag}`);
          successCount++;
        } catch (_) {
          failCount++;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(isMute ? COLORS.WARNING : COLORS.SUCCESS)
        .setTitle(isMute ? '🔇 Mass Server Mute Completed!' : '🔊 Mass Server Unmute Completed!')
        .setDescription(
          `Successfully ${isMute ? 'server muted' : 'server unmuted'} **${successCount}** member${successCount === 1 ? '' : 's'} in <#${targetChannel.id}>!` +
          (immuneMuteCount > 0 ? `\n🛡️ *${immuneMuteCount} immune member(s) were protected and skipped.*` : '') +
          (failCount > 0 ? `\n⚠️ *${failCount} member(s) could not be ${isMute ? 'muted' : 'unmuted'} (missing permissions or higher role).*` : '')
        )
        .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // +vc bounce @user OR +bounce @user OR +vcbounce @user OR +orbit @user
    const isBounceAction = action === 'bounce' || action === 'orbit' || action === 'tour' || action === 'drag' || action === 'vcbounce' ||
      invokedCommand === 'bounce' || invokedCommand === 'vcbounce' || invokedCommand === 'orbit' || invokedCommand === 'vcorbit' ||
      invokedCommand === 'vctour' || invokedCommand === 'tour' || invokedCommand === 'drag' || invokedCommand === 'vcdrag';

    if (isBounceAction) {
      if (!isOwnerOrAdmin(message.member || message.author, message.guild, client)) {
        return message.reply('🚫 The `+vc bounce` command can only be used by the **Bot Developer**, **Server Owner**, and **Administrators**.');
      }

      const guild = message.guild;
      const botMember = await guild.members.fetchMe().catch(() => null);
      if (!botMember?.permissions.has(PermissionsBitField.Flags.MoveMembers) &&
          !botMember?.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('🚫 I do not have the **Move Members** permission in this server to bounce members.');
      }

      const targetArgs = (action === 'bounce' || action === 'orbit' || action === 'tour' || action === 'drag' || action === 'vcbounce')
        ? args.slice(1)
        : args;

      const rawTargetId = targetArgs[0] ? targetArgs[0].replace(/[<@!>]/g, '') : null;
      if (rawTargetId && immunityService.isImmune(rawTargetId, guild, client, settings)) {
        return message.reply(`🛡️ **Immunity Protected**: <@${rawTargetId}> possesses **Immunity** and cannot be targeted by the voice bounce command (even by the Server Owner).`);
      }

      let targetMember = message.mentions.members.first();
      if (!targetMember && rawTargetId) {
        targetMember = guild.members.cache.get(rawTargetId) ||
          (await guild.members.fetch(rawTargetId).catch(() => null)) ||
          guild.members.cache.find(m => m.user.username.toLowerCase() === targetArgs[0].toLowerCase());
      }

      if (targetMember && immunityService.isImmune(targetMember, guild, client, settings)) {
        return message.reply(`🛡️ **Immunity Protected**: <@${targetMember.id}> possesses **Immunity** and cannot be targeted by the voice bounce command (even by the Server Owner).`);
      }

      // Stop command: +vc bounce stop @member or +bounce stop @member
      const isStop = targetArgs.some(a => ['stop', 'cancel', 'halt'].includes(a.toLowerCase()));
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
          '• **Usage:** `+vc bounce @member [rounds]`\n' +
          '• **Examples:** `+vc bounce @member 10` or `+vc bounce @member count:100`\n' +
          '• **Stop Tour:** `+vc bounce stop @member`\n' +
          '• **Don\'t return:** `+vc bounce @member 10 false`'
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

      // Prevent concurrent bounce on same user
      if (bounceManager.isBouncing(targetMember.id)) {
        return message.reply(`⚠️ <@${targetMember.id}> is already in an active voice tour. Use \`+vc bounce stop @member\` to stop it.`);
      }

      // Parse rounds (supports 10, count 10, count:10, rounds:100, etc.)
      const rounds = bounceManager.parseRounds(targetArgs);
      const returnToStart = !targetArgs.some(a => ['false', 'no', '0'].includes(a.toLowerCase()));

      const startMsg = await message.reply(
        `🌀 **Starting Voice Bounce for <@${targetMember.id}>!**\n` +
        `Target: **${rounds}** round${rounds === 1 ? '' : 's'}... *(Type \`+vc bounce stop @member\` to cancel)*`
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
            `Completed **${completed}/${total}** rounds (**${moved}** moves, ${Math.round((completed / total) * 100)}%)... *(Type \`+vc bounce stop @member\` to cancel)*`
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
    if (!voiceChannel) {
      return message.reply('❌ You must be connected to your temporary voice channel. (Or use `+vc setup` as an admin).');
    }

    const tempDoc = await TempVoice.findOne({ channelId: voiceChannel.id });
    if (!tempDoc) {
      return message.reply('❌ This channel is not a bot-managed temporary voice channel.');
    }

    const isOwner = tempDoc.ownerId === message.author.id;
    const isAdmin = isOwnerOrAdmin(message.member || message.author, message.guild, client);

    if (!isOwner && !isAdmin) {
      return message.reply('🚫 Only the channel creator or an administrator can manage this voice lounge.');
    }

    if (action === 'panel') {
      const voiceManager = require('../../modules/voiceManager');
      const panelData = voiceManager.buildControlPanel(voiceChannel, message.member);
      await voiceChannel.send({
        content: `👋 <@${message.author.id}>, here is your voice channel control panel:`,
        embeds: panelData.embeds,
        components: panelData.components
      });
      return message.reply('✅ Voice control panel posted in your channel!');
    } else if (action === 'lock') {
      await voiceChannel.permissionOverwrites.edit(message.guild.roles.everyone, { Connect: false });
      return message.reply('🔒 Voice channel locked.');
    } else if (action === 'unlock') {
      await voiceChannel.permissionOverwrites.edit(message.guild.roles.everyone, { Connect: true });
      return message.reply('🔓 Voice channel unlocked.');
    } else if (action === 'hide') {
      await voiceChannel.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: false });
      return message.reply('👻 Voice channel hidden.');
    } else if (action === 'show') {
      await voiceChannel.permissionOverwrites.edit(message.guild.roles.everyone, { ViewChannel: true });
      return message.reply('👁️ Voice channel visible.');
    } else if (action === 'limit') {
      const count = parseInt(args[1], 10);
      if (isNaN(count)) return message.reply('❌ Usage: `+vc limit <number>`');
      await voiceChannel.setUserLimit(count);
      return message.reply(`👥 User limit set to **${count}**.`);
    } else if (action === 'name' || action === 'rename') {
      const newName = args.slice(1).join(' ');
      if (!newName) return message.reply('❌ Usage: `+vc name <new name>`');
      await voiceChannel.setName(newName);
      return message.reply(`✏️ Channel renamed to **"${newName}"**.`);
    } else if (action === 'give' || action === 'transfer') {
      const targetUser = message.mentions.users.first();
      if (!targetUser) return message.reply('❌ Usage: `+vc give @member`');
      tempDoc.ownerId = targetUser.id;
      await tempDoc.save();
      return message.reply(`👑 Transferred ownership to <@${targetUser.id}>.`);
    } else {
      return message.reply('ℹ️ Quick commands: `+vc setup`, `+vc panel`, `+vc lock`, `+vc unlock`, `+vc hide`, `+vc show`, `+vc limit <n>`, `+vc name <name>`, `+vc give @member`.');
    }
  }
};
