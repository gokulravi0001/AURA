const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField
} = require('discord.js');
const emojiManager = require('../../modules/emojiManager');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('emoji')
    .setDescription('Add, mass add, selectively steal, or install emoji packs')
    .addSubcommand(sub =>
      sub.setName('steal')
        .setDescription('Detect and mass add or selectively add emojis from custom emojis or text')
        .addStringOption(opt =>
          opt.setName('emojis')
            .setDescription('Paste one or multiple custom emojis or image URLs')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a single emoji from a custom emoji or image URL')
        .addStringOption(opt =>
          opt.setName('target')
            .setDescription('Custom emoji (<:name:id>) or image URL')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('name')
            .setDescription('Custom name for the new emoji')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('packs')
        .setDescription('Browse and install curated emoji packs (Pepe, Anime, Gaming, Aesthetic, Badges)')
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('View current server emoji slots, statistics, and installed emojis')
    ),

  name: 'emoji',
  description: 'Add, mass add, selectively steal, or install emoji packs',
  aliases: ['steal', 'emojis', 'massadd', 'massaddemoji', 'emojipack', 'emojipacks'],
  module: 'emoji_manager',

  async execute(interaction, client, settings) {
    // 1. Permission checks
    const hasUserPerm = interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuildExpressions) ||
                        interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!hasUserPerm) {
      return interaction.reply({
        content: '🚫 You need the **Manage Expressions / Emojis** permission to use emoji management.',
        ephemeral: true
      });
    }

    const guild = interaction.guild;
    const botMember = await guild.members.fetchMe().catch(() => null);
    const hasBotPerm = botMember?.permissions.has(PermissionsBitField.Flags.ManageGuildExpressions) ||
                       botMember?.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!hasBotPerm) {
      return interaction.reply({
        content: '🚫 I do not have the **Manage Expressions / Emojis** permission in this server to manage emojis.',
        ephemeral: true
      });
    }

    const sub = interaction.options.getSubcommand();

    // 2. PACKS
    if (sub === 'packs') {
      const panel = emojiManager.buildPacksPanel(guild);
      return interaction.reply({ embeds: panel.embeds, components: panel.components });
    }

    // 3. LIST
    if (sub === 'list') {
      const slots = emojiManager.getEmojiSlots(guild);
      const allEmojis = [...guild.emojis.cache.values()];

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`🎨 Server Emojis — ${guild.name}`)
        .setDescription(
          `### 📊 Capacity & Slots\n` +
          `• **Total Installed:** \`${allEmojis.length}\`\n` +
          `• **Static:** \`${slots.currentStatic}/${slots.maxPerType}\` (Free: **${slots.freeStatic}**)\n` +
          `• **Animated:** \`${slots.currentAnimated}/${slots.maxPerType}\` (Free: **${slots.freeAnimated}**)\n` +
          `• **Server Tier:** Level \`${slots.tier}\`\n\n` +
          (allEmojis.length > 0
            ? `### Installed Emojis\n` + allEmojis.slice(0, 45).map(e => e.toString()).join(' ') + (allEmojis.length > 45 ? `\n*...and ${allEmojis.length - 45} more*` : '')
            : '*No custom emojis installed in this server yet.*')
        )
        .setFooter({ text: 'Use /emoji steal or /emoji packs to add more emojis' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 4. ADD (Single emoji)
    if (sub === 'add') {
      const target = interaction.options.getString('target');
      const customName = interaction.options.getString('name');

      const parsed = emojiManager.parseEmojis(target);
      if (parsed.length === 0) {
        return interaction.reply({
          content: '❌ Could not find a valid custom emoji or image link in your input.',
          ephemeral: true
        });
      }

      await interaction.deferReply();
      const item = parsed[0];
      if (customName) item.name = customName;

      const results = await emojiManager.uploadEmojis(guild, [item], interaction.user);
      const resultEmbed = emojiManager.buildResultEmbed(results, guild, interaction.user);
      return interaction.followUp({ embeds: [resultEmbed] });
    }

    // 5. STEAL (Mass or Selective)
    if (sub === 'steal') {
      const rawInput = interaction.options.getString('emojis');
      const parsed = emojiManager.parseEmojis(rawInput);

      if (parsed.length === 0) {
        return interaction.reply({
          content: '❌ No custom emojis or image URLs were detected in your input. Please paste custom emojis (e.g. `<:pepe:123...>`) or direct image links.',
          ephemeral: true
        });
      }

      // If only 1 emoji provided, directly upload with confirmation
      if (parsed.length === 1) {
        await interaction.deferReply();
        const results = await emojiManager.uploadEmojis(guild, parsed, interaction.user);
        const resultEmbed = emojiManager.buildResultEmbed(results, guild, interaction.user);
        return interaction.followUp({ embeds: [resultEmbed] });
      }

      // 2 or more emojis: Show interactive Selective vs Mass Add Panel
      const sessionId = emojiManager.createSession(interaction.user.id, guild.id, parsed, 'Detected Emojis');
      const panel = emojiManager.buildSelectivePanel(sessionId, guild);

      return interaction.reply({
        embeds: panel.embeds,
        components: panel.components
      });
    }
  },

  async executePrefix(message, args, client, settings) {
    const prefix = settings?.prefix || '+';
    const invoked = message.content.slice(prefix.length).trim().split(/ +/)[0]?.toLowerCase();
    const action = args[0]?.toLowerCase();

    // Permission checks
    const hasUserPerm = message.member.permissions.has(PermissionsBitField.Flags.ManageGuildExpressions) ||
                        message.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!hasUserPerm) {
      return message.reply('🚫 You need the **Manage Expressions / Emojis** permission to use emoji management.');
    }

    const guild = message.guild;
    const botMember = await guild.members.fetchMe().catch(() => null);
    const hasBotPerm = botMember?.permissions.has(PermissionsBitField.Flags.ManageGuildExpressions) ||
                       botMember?.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!hasBotPerm) {
      return message.reply('🚫 I do not have the **Manage Expressions / Emojis** permission in this server to manage emojis.');
    }

    // 1. PACKS
    if (action === 'packs' || action === 'pack' || invoked === 'emojipack' || invoked === 'emojipacks') {
      const panel = emojiManager.buildPacksPanel(guild);
      return message.reply({ embeds: panel.embeds, components: panel.components });
    }

    // 2. LIST
    if (action === 'list' || invoked === 'emojis') {
      const slots = emojiManager.getEmojiSlots(guild);
      const allEmojis = [...guild.emojis.cache.values()];

      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`🎨 Server Emojis — ${guild.name}`)
        .setDescription(
          `### 📊 Capacity & Slots\n` +
          `• **Total Installed:** \`${allEmojis.length}\`\n` +
          `• **Static:** \`${slots.currentStatic}/${slots.maxPerType}\` (Free: **${slots.freeStatic}**)\n` +
          `• **Animated:** \`${slots.currentAnimated}/${slots.maxPerType}\` (Free: **${slots.freeAnimated}**)\n` +
          `• **Server Tier:** Level \`${slots.tier}\`\n\n` +
          (allEmojis.length > 0
            ? `### Installed Emojis\n` + allEmojis.slice(0, 45).map(e => e.toString()).join(' ') + (allEmojis.length > 45 ? `\n*...and ${allEmojis.length - 45} more*` : '')
            : '*No custom emojis installed in this server yet.*')
        )
        .setFooter({ text: `Type ${prefix}steal <emojis> or ${prefix}emoji packs to add more emojis` })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // 3. Collect input text from message args and replied message (if any)
    let fullInput = args.join(' ');
    if (action === 'steal' || action === 'add' || action === 'massadd') {
      fullInput = args.slice(1).join(' ');
    }

    // Support stealing from replied message
    if (message.reference?.messageId) {
      const repliedMsg = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
      if (repliedMsg?.content) {
        fullInput = fullInput + ' ' + repliedMsg.content;
      }
    }

    // Check message attachments for direct image files
    if (message.attachments.size > 0) {
      const attachUrls = message.attachments.map(a => a.url).join(' ');
      fullInput = fullInput + ' ' + attachUrls;
    }

    const parsed = emojiManager.parseEmojis(fullInput);

    if (parsed.length === 0) {
      return message.reply(
        `❌ No custom emojis or image URLs detected!\n\n` +
        `• **Mass Add or Selectively Add:** \`${prefix}steal <emojis...>\` or \`${prefix}massadd <emojis...>\`\n` +
        `• **Reply to a message:** Reply to any message with \`${prefix}steal\` to extract its emojis!\n` +
        `• **Curated Emoji Packs:** \`${prefix}emoji packs\`\n` +
        `• **List Server Emojis:** \`${prefix}emoji list\``
      );
    }

    // If only 1 emoji provided, upload directly
    if (parsed.length === 1) {
      // If user provided a custom name as args[1]
      if (action === 'add' && args[2]) {
        parsed[0].name = args[2];
      }

      const waitMsg = await message.reply('⏳ Uploading emoji to server...');
      const results = await emojiManager.uploadEmojis(guild, parsed, message.author);
      const resultEmbed = emojiManager.buildResultEmbed(results, guild, message.author);
      return waitMsg.edit({ content: null, embeds: [resultEmbed] });
    }

    // 2 or more emojis: Show Interactive Selective vs Mass Add Panel
    const sessionId = emojiManager.createSession(message.author.id, guild.id, parsed, 'Detected Emojis');
    const panel = emojiManager.buildSelectivePanel(sessionId, guild);

    return message.reply({
      embeds: panel.embeds,
      components: panel.components
    });
  }
};
