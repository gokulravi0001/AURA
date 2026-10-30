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
    ),
  name: 'vc',
  description: 'Manage temporary voice channels or setup Join-to-Create',
  aliases: ['voice', 'tempvoice'],
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
