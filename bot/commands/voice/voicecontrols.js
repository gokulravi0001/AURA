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
        .setDescription('Mass move all members from one voice channel to another')
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
        .setDescription('Mass disconnect all members from a voice channel')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Voice channel to disconnect members from (defaults to your current voice channel)')
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        )
    )
    .addSubcommand(sub =>
      sub.setName('mute')
        .setDescription('Mass server-mute all members in a voice channel')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Voice channel to mute members in (defaults to your current voice channel)')
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        )
    )
    .addSubcommand(sub =>
      sub.setName('unmute')
        .setDescription('Mass server-unmute all members in a voice channel')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Voice channel to unmute members in (defaults to your current voice channel)')
            .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        )
    ),
  name: 'vc',
  description: 'Manage temporary voice channels or setup Join-to-Create',
  aliases: [
    'voice', 'tempvoice',
    'massmove', 'movevc',
    'massdc', 'massdisconnect', 'vcdc', 'disconnectvc',
    'massmute', 'massunmute', 'vcmute', 'vcunmute', 'mutevc', 'unmutevc'
  ],
  module: 'join_to_create',

  async execute(interaction, client, settings) {
    const sub = interaction.options.getSubcommand();

    // 1. SETUP COMMAND (Admin only)
    if (sub === 'setup') {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
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

    // 2. MASS MOVE COMMAND (Requires MoveMembers or Administrator)
    if (sub === 'move') {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.MoveMembers) &&
          !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: '🚫 You need the **Move Members** permission to use mass move.', ephemeral: true });
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

      const membersToMove = [...sourceChannel.members.values()];
      if (membersToMove.length === 0) {
        return interaction.reply({ content: `⚠️ No members are currently connected to <#${sourceChannel.id}>.`, ephemeral: true });
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
          (failCount > 0 ? `\n⚠️ *${failCount} member(s) could not be moved (missing permissions or disconnected).*` : '')
        )
        .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      return interaction.followUp({ embeds: [embed] });
    }

    // 3. MASS DISCONNECT COMMAND (Requires MoveMembers or Administrator)
    if (sub === 'disconnect') {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.MoveMembers) &&
          !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: '🚫 You need the **Move Members** permission to use mass disconnect.', ephemeral: true });
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

      const membersToDisconnect = [...targetChannel.members.values()];
      if (membersToDisconnect.length === 0) {
        return interaction.reply({ content: `⚠️ No members are currently connected to <#${targetChannel.id}>.`, ephemeral: true });
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
          (failCount > 0 ? `\n⚠️ *${failCount} member(s) could not be disconnected (missing permissions or already left).*` : '')
        )
        .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      return interaction.followUp({ embeds: [embed] });
    }

    // 4. MASS MUTE & UNMUTE COMMAND (Requires MuteMembers or Administrator)
    if (sub === 'mute' || sub === 'unmute') {
      const isMute = sub === 'mute';

      if (!interaction.member.permissions.has(PermissionsBitField.Flags.MuteMembers) &&
          !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({
          content: `🚫 You need the **Mute Members** permission to use mass ${isMute ? 'mute' : 'unmute'}.`,
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

      const membersToProcess = channelMembers.filter(m => {
        if (m.id === client.user.id) return false;
        return isMute ? !m.voice.serverMute : m.voice.serverMute;
      });

      if (membersToProcess.length === 0) {
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
          (failCount > 0 ? `\n⚠️ *${failCount} member(s) could not be ${isMute ? 'muted' : 'unmuted'} (missing permissions or higher role).*` : '')
        )
        .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      return interaction.followUp({ embeds: [embed] });
    }

    // Voice controls require being inside a temp channel
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: '❌ You must be connected to your temporary voice channel to use this command.', ephemeral: true });
    }

    const tempDoc = await TempVoice.findOne({ channelId: voiceChannel.id });
    if (!tempDoc) {
      return interaction.reply({ content: '❌ This channel is not a bot-managed temporary channel.', ephemeral: true });
    }

    const isOwner = tempDoc.ownerId === interaction.user.id;
    const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);

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
      if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
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
      if (!message.member.permissions.has(PermissionsBitField.Flags.MoveMembers) &&
          !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('🚫 You need the **Move Members** permission to use mass move.');
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

      const membersToMove = [...sourceChannel.members.values()];
      if (membersToMove.length === 0) {
        return message.reply(`⚠️ No members are currently connected to <#${sourceChannel.id}>.`);
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
      if (!message.member.permissions.has(PermissionsBitField.Flags.MoveMembers) &&
          !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply('🚫 You need the **Move Members** permission to use mass disconnect.');
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

      const membersToDisconnect = [...targetChannel.members.values()];
      if (membersToDisconnect.length === 0) {
        return message.reply(`⚠️ No members are currently connected to <#${targetChannel.id}>.`);
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

      return message.reply({ embeds: [embed] });
    }

    // +vc mute [#channel] OR +massmute [#channel] OR +vc unmute [#channel] OR +massunmute [#channel]
    const isMuteAction = action === 'mute' || action === 'massmute' || action === 'servermute' ||
      invokedCommand === 'massmute' || invokedCommand === 'vcmute' || invokedCommand === 'mutevc';
    const isUnmuteAction = action === 'unmute' || action === 'massunmute' || action === 'serverunmute' ||
      invokedCommand === 'massunmute' || invokedCommand === 'vcunmute' || invokedCommand === 'unmutevc';

    if (isMuteAction || isUnmuteAction) {
      const isMute = isMuteAction;

      if (!message.member.permissions.has(PermissionsBitField.Flags.MuteMembers) &&
          !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply(`🚫 You need the **Mute Members** permission to use mass ${isMute ? 'mute' : 'unmute'}.`);
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

      const membersToProcess = channelMembers.filter(m => {
        if (m.id === client.user.id) return false;
        return isMute ? !m.voice.serverMute : m.voice.serverMute;
      });

      if (membersToProcess.length === 0) {
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
          (failCount > 0 ? `\n⚠️ *${failCount} member(s) could not be ${isMute ? 'muted' : 'unmuted'} (missing permissions or higher role).*` : '')
        )
        .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return message.reply('❌ You must be connected to your temporary voice channel. (Or use `+vc setup` as an admin).');
    }

    const tempDoc = await TempVoice.findOne({ channelId: voiceChannel.id });
    if (!tempDoc) {
      return message.reply('❌ This channel is not a bot-managed temporary voice channel.');
    }

    if (tempDoc.ownerId !== message.author.id && !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
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
