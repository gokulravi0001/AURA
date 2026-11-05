const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} = require('discord.js');
const { COLORS } = require('../../shared/constants');
const logger = require('../../shared/logger');
const { hasPermissionOrOwner } = require('../../shared/permissionHelper');

// Regex for custom Discord emojis: <:name:id> or <a:name:id>
const DISCORD_EMOJI_REGEX = /<(a)?:([a-zA-Z0-9_]{2,32}):(\d{17,20})>/g;
// Regex for image links
const IMAGE_URL_REGEX = /(https?:\/\/[^\s]+(?:\.png|\.jpg|\.jpeg|\.webp|\.gif)(?:\?[^\s]*)?)/gi;

// Curated Popular Emoji Packs
const EMOJI_PACKS = {
  pepe: {
    id: 'pepe',
    name: '🐸 Pepe & Memes Pack',
    description: 'Classic Pepe, meme reactions, and funny expressive icons',
    emojis: [
      { name: 'pepe_happy', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f604.png', animated: false },
      { name: 'pepe_cry', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f62d.png', animated: false },
      { name: 'pepe_clown', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f921.png', animated: false },
      { name: 'pepe_cool', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f60e.png', animated: false },
      { name: 'skull_fire', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f480.png', animated: false },
      { name: 'party_pop', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f389.png', animated: false },
      { name: 'hundred_real', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4af.png', animated: false },
      { name: 'mind_blown', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f92f.png', animated: false }
    ]
  },
  anime: {
    id: 'anime',
    name: '🌸 Anime & Chibi Pack',
    description: 'Chibi emotions, sparkles, catgirls, and anime aesthetics',
    emojis: [
      { name: 'anya_smug', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f60f.png', animated: false },
      { name: 'sparkle_heart', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f496.png', animated: false },
      { name: 'catgirl_grin', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f638.png', animated: false },
      { name: 'chibi_pout', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f624.png', animated: false },
      { name: 'star_eyes', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f929.png', animated: false },
      { name: 'sweat_smile', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f605.png', animated: false },
      { name: 'naruto_ramen', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f35c.png', animated: false },
      { name: 'sakura_bloom', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f338.png', animated: false }
    ]
  },
  gaming: {
    id: 'gaming',
    name: '🎮 Gaming & Esports Pack',
    description: 'Game controllers, swords, trophies, and retro arcade items',
    emojis: [
      { name: 'game_controller', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f3ae.png', animated: false },
      { name: 'diamond_dagger', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f5e1.png', animated: false },
      { name: 'gg_trophy', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f3c6.png', animated: false },
      { name: 'pro_headset', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f3a7.png', animated: false },
      { name: 'retro_arcade', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f579.png', animated: false },
      { name: 'pixel_heart', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2764.png', animated: false },
      { name: 'super_fire', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f525.png', animated: false },
      { name: 'lightning_zap', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/26a1.png', animated: false }
    ]
  },
  aesthetic: {
    id: 'aesthetic',
    name: '✨ Aesthetic & Vibes Pack',
    description: 'Glowing gems, sparkles, butterflies, moon, and elegant symbols',
    emojis: [
      { name: 'gold_sparkles', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2728.png', animated: false },
      { name: 'blue_gem', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f48e.png', animated: false },
      { name: 'royal_crown', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f451.png', animated: false },
      { name: 'violet_butterfly', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f98b.png', animated: false },
      { name: 'glowing_moon', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f319.png', animated: false },
      { name: 'mystic_orb', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f52e.png', animated: false },
      { name: 'hibiscus_bloom', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f33a.png', animated: false },
      { name: 'shining_star', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f31f.png', animated: false }
    ]
  },
  badges: {
    id: 'badges',
    name: '🛡️ Server Badges & Mod Pack',
    description: 'Verification checks, shields, megaphones, giveaways, and VIP keys',
    emojis: [
      { name: 'verified_check', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2705.png', animated: false },
      { name: 'mod_shield', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f6e1.png', animated: false },
      { name: 'announce_horn', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4e2.png', animated: false },
      { name: 'rules_pin', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4cc.png', animated: false },
      { name: 'giveaway_gift', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f381.png', animated: false },
      { name: 'vip_key', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f511.png', animated: false },
      { name: 'notify_bell', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f514.png', animated: false },
      { name: 'gold_star', url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/2b50.png', animated: false }
    ]
  }
};

// In-memory active interactive sessions
// Map<sessionId, { userId, guildId, emojis: Array, selectedIndexes: Set<number>, title: string, createdAt: number }>
const sessions = new Map();

// Session cleaner (runs every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > 15 * 60 * 1000) {
      sessions.delete(id);
    }
  }
}, 10 * 60 * 1000);

const emojiManager = {
  EMOJI_PACKS,

  /**
   * Parse Discord custom emojis and image URLs from arbitrary input text
   * @param {string} text
   * @returns {Array<{ name: string, id: string|null, animated: boolean, url: string }>}
   */
  parseEmojis(text) {
    if (!text || typeof text !== 'string') return [];

    const found = [];
    const seenUrls = new Set();

    // 1. Match Discord custom emojis
    let match;
    const emojiRegex = new RegExp(DISCORD_EMOJI_REGEX.source, 'g');
    while ((match = emojiRegex.exec(text)) !== null) {
      const isAnimated = !!match[1];
      const name = match[2];
      const id = match[3];
      const extension = isAnimated ? 'gif' : 'png';
      const url = `https://cdn.discordapp.com/emojis/${id}.${extension}`;

      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        found.push({
          name,
          id,
          animated: isAnimated,
          url
        });
      }
    }

    // 2. Match raw image links (if not already matched)
    const urlRegex = new RegExp(IMAGE_URL_REGEX.source, 'gi');
    while ((match = urlRegex.exec(text)) !== null) {
      const rawUrl = match[1];
      if (!seenUrls.has(rawUrl)) {
        seenUrls.add(rawUrl);
        const isAnimated = rawUrl.toLowerCase().includes('.gif');
        // Extract clean name from URL filename
        const cleanName = rawUrl
          .split('/')
          .pop()
          .split('?')[0]
          .replace(/\.(png|jpg|jpeg|webp|gif)$/i, '')
          .replace(/[^a-zA-Z0-9_]/g, '_')
          .substring(0, 32) || 'custom_emoji';

        found.push({
          name: cleanName,
          id: null,
          animated: isAnimated,
          url: rawUrl
        });
      }
    }

    return found;
  },

  /**
   * Get server emoji limits and current counts
   */
  getEmojiSlots(guild) {
    const tierLimits = { 0: 50, 1: 100, 2: 150, 3: 250 };
    const maxPerType = tierLimits[guild.premiumTier] || 50;

    const cache = guild?.emojis?.cache || [];
    const values = typeof cache.values === 'function' ? [...cache.values()] : (Array.isArray(cache) ? cache : []);

    const currentStatic = values.filter(e => !e.animated).length;
    const currentAnimated = values.filter(e => e.animated).length;

    return {
      maxPerType,
      currentStatic,
      currentAnimated,
      freeStatic: Math.max(0, maxPerType - currentStatic),
      freeAnimated: Math.max(0, maxPerType - currentAnimated),
      tier: guild.premiumTier || 0
    };
  },

  /**
   * Create an interactive session for selective / mass emoji adding
   */
  createSession(userId, guildId, emojis, title = 'Detected Emojis') {
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    sessions.set(sessionId, {
      userId,
      guildId,
      emojis,
      selectedIndexes: new Set(),
      title,
      createdAt: Date.now()
    });
    return sessionId;
  },

  /**
   * Build the Interactive Selective / Mass Add Panel
   */
  buildSelectivePanel(sessionId, guild) {
    const session = sessions.get(sessionId);
    if (!session) return null;

    const slots = this.getEmojiSlots(guild);
    const { emojis, selectedIndexes, title } = session;

    // Build preview list
    const previewLines = emojis.slice(0, 12).map((item, idx) => {
      const isSelected = selectedIndexes.has(idx);
      const icon = item.id ? `<${item.animated ? 'a' : ''}:${item.name}:${item.id}>` : (item.animated ? '🎞️' : '🖼️');
      const badge = isSelected ? '✅ `[SELECTED]`' : '⬜ `[      ]`';
      return `${badge} ${icon} **\`:${item.name}:\`** (${item.animated ? 'Animated' : 'Static'})`;
    });

    if (emojis.length > 12) {
      previewLines.push(`*...and ${emojis.length - 12} more emoji(s)*`);
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`✨ ${title} (${emojis.length} Total)`)
      .setDescription(
        `### Server Slot Capacity\n` +
        `• **Static:** \`${slots.currentStatic}/${slots.maxPerType}\` (Free: **${slots.freeStatic}**)\n` +
        `• **Animated:** \`${slots.currentAnimated}/${slots.maxPerType}\` (Free: **${slots.freeAnimated}**)\n\n` +
        `### Emojis to Add\n` +
        previewLines.join('\n') +
        `\n\n📌 **How to Use:**\n` +
        `• Click **⚡ Mass Add All** to immediately upload all **${emojis.length}** emojis.\n` +
        `• Or select specific emojis in the **Dropdown Menu** below and click **✅ Add Selected (${selectedIndexes.size})**!`
      )
      .setFooter({ text: `AURA Emoji Manager • Session expires in 15 mins` })
      .setTimestamp();

    // Select Menu for selective picking (Discord allows up to 25 items in select menu)
    const selectOptions = emojis.slice(0, 25).map((item, idx) => {
      const opt = new StringSelectMenuOptionBuilder()
        .setLabel(item.name.substring(0, 25))
        .setValue(String(idx))
        .setDescription(item.animated ? 'Animated GIF emoji' : 'Static PNG emoji')
        .setDefault(selectedIndexes.has(idx));

      if (item.id) {
        opt.setEmoji({ name: item.name, id: item.id, animated: item.animated });
      }
      return opt;
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`emoji_select_${sessionId}`)
      .setPlaceholder(`🔍 Select specific emojis to add (${selectedIndexes.size} selected)...`)
      .setMinValues(1)
      .setMaxValues(Math.min(25, emojis.length))
      .addOptions(selectOptions);

    const rowSelect = new ActionRowBuilder().addComponents(selectMenu);

    const rowButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`emoji_btn_all_${sessionId}`)
        .setLabel(`Mass Add All (${emojis.length})`)
        .setStyle(ButtonStyle.Success)
        .setEmoji('⚡'),
      new ButtonBuilder()
        .setCustomId(`emoji_btn_selected_${sessionId}`)
        .setLabel(`Add Selected (${selectedIndexes.size})`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(selectedIndexes.size === 0)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`emoji_btn_cancel_${sessionId}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌')
    );

    return {
      embeds: [embed],
      components: [rowSelect, rowButtons]
    };
  },

  /**
   * Build the Emoji Packs Selection Panel
   */
  buildPacksPanel(guild) {
    const slots = this.getEmojiSlots(guild);

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('📦 Curated Emoji Packs')
      .setDescription(
        'Browse and install ready-to-use emoji collections directly into your server!\n' +
        'Choose a pack from the dropdown menu to preview its emojis, then either **Mass Add All** or **Selectively Pick** which ones to install.\n\n' +
        `### Current Server Capacity\n` +
        `• Static: \`${slots.currentStatic}/${slots.maxPerType}\` (Free: **${slots.freeStatic}**)\n` +
        `• Animated: \`${slots.currentAnimated}/${slots.maxPerType}\` (Free: **${slots.freeAnimated}**)\n\n` +
        `### Available Packs\n` +
        Object.values(EMOJI_PACKS).map(pack => `• **${pack.name}** (${pack.emojis.length} emojis)\n  *${pack.description}*`).join('\n')
      )
      .setFooter({ text: 'Select a pack from the dropdown menu below' });

    const packOptions = Object.values(EMOJI_PACKS).map(pack =>
      new StringSelectMenuOptionBuilder()
        .setLabel(pack.name.replace(/^[^\w\s]+/, '').trim())
        .setValue(pack.id)
        .setDescription(pack.description.substring(0, 100))
        .setEmoji(pack.name.split(' ')[0] || '📦')
    );

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('emoji_pack_select')
        .setPlaceholder('📦 Choose an Emoji Pack to inspect & install...')
        .addOptions(packOptions)
    );

    return { embeds: [embed], components: [row] };
  },

  /**
   * Execute batch upload of emojis to a guild
   * @param {import('discord.js').Guild} guild
   * @param {Array<{ name: string, url: string, animated: boolean }>} items
   * @param {import('discord.js').User} user
   */
  async uploadEmojis(guild, items, user) {
    const results = {
      success: [],
      failed: []
    };

    const slots = this.getEmojiSlots(guild);
    let remainingStatic = slots.freeStatic;
    let remainingAnimated = slots.freeAnimated;

    for (const item of items) {
      // Check slot limits
      if (!item.animated && remainingStatic <= 0) {
        results.failed.push({ item, error: 'No free static emoji slots left' });
        continue;
      }
      if (item.animated && remainingAnimated <= 0) {
        results.failed.push({ item, error: 'No free animated emoji slots left' });
        continue;
      }

      const cleanName = (item.name || 'emoji')
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .substring(0, 32);

      try {
        const created = await guild.emojis.create({
          attachment: item.url,
          name: cleanName || 'custom_emoji',
          reason: `Added by ${user.tag || user.username} via AURA Emoji Manager`
        });

        results.success.push(created);
        if (created.animated) {
          remainingAnimated--;
        } else {
          remainingStatic--;
        }

        // Slight rate limit safety buffer
        await new Promise(r => setTimeout(r, 650));
      } catch (err) {
        logger.warn(`Failed to create emoji ${cleanName}:`, err.message);
        results.failed.push({ item, error: err.message });
      }
    }

    return results;
  },

  /**
   * Build the Result Embed after uploading
   */
  buildResultEmbed(results, guild, user) {
    const slots = this.getEmojiSlots(guild);
    const hasSuccess = results.success.length > 0;
    const hasFail = results.failed.length > 0;

    const embed = new EmbedBuilder()
      .setColor(hasSuccess ? COLORS.SUCCESS : COLORS.ERROR)
      .setTitle(hasSuccess ? '🎉 Emoji Upload Completed!' : '❌ Emoji Upload Failed')
      .setFooter({ text: `Requested by ${user.username}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    let desc = '';

    if (hasSuccess) {
      desc += `### Successfully Added (${results.success.length})\n`;
      desc += results.success.map(e => `${e.toString()} \`:${e.name}:\``).join(' ') + '\n\n';
    }

    if (hasFail) {
      desc += `### ⚠️ Could Not Add (${results.failed.length})\n`;
      desc += results.failed.map(f => `• **${f.item.name}**: *${f.error}*`).join('\n') + '\n\n';
    }

    desc += `### Remaining Slots\n• Static: \`${slots.freeStatic}\` left • Animated: \`${slots.freeAnimated}\` left`;
    embed.setDescription(desc);

    return embed;
  },

  /**
   * Handle Button interactions for Emoji Manager
   */
  async handleButton(interaction, client) {
    const customId = interaction.customId;
    const parts = customId.split('_');
    // emoji_btn_all_sessionId or emoji_btn_selected_sessionId or emoji_btn_cancel_sessionId
    const action = parts[2];
    const sessionId = parts.slice(3).join('_');
    const session = sessions.get(sessionId);

    // Permission check (Bypassed for Bot Developers / Owners)
    const hasPerm = hasPermissionOrOwner(interaction.member || interaction.user, PermissionsBitField.Flags.ManageGuildExpressions, client);
    if (!hasPerm) {
      return interaction.reply({
        content: '🚫 You need the **Manage Expressions / Emojis** permission to add emojis.',
        ephemeral: true
      });
    }

    if (action === 'cancel') {
      sessions.delete(sessionId);
      return interaction.update({
        content: '❌ Emoji adding cancelled.',
        embeds: [],
        components: []
      });
    }

    if (!session) {
      return interaction.reply({
        content: '⚠️ This emoji session has expired. Please run the command again.',
        ephemeral: true
      });
    }

    // Determine which emojis to upload
    let emojisToUpload = [];
    if (action === 'all') {
      emojisToUpload = session.emojis;
    } else if (action === 'selected') {
      if (session.selectedIndexes.size === 0) {
        return interaction.reply({
          content: '⚠️ Please select at least one emoji from the dropdown menu first!',
          ephemeral: true
        });
      }
      emojisToUpload = [...session.selectedIndexes].map(i => session.emojis[i]).filter(Boolean);
    }

    await interaction.update({
      content: `⏳ Uploading **${emojisToUpload.length}** emoji(s) to server... Please wait!`,
      embeds: [],
      components: []
    });

    const results = await this.uploadEmojis(interaction.guild, emojisToUpload, interaction.user);
    sessions.delete(sessionId);

    const resultEmbed = this.buildResultEmbed(results, interaction.guild, interaction.user);
    return interaction.editReply({
      content: null,
      embeds: [resultEmbed],
      components: []
    });
  },

  /**
   * Handle Select Menu interactions for Emoji Manager
   */
  async handleSelectMenu(interaction, client) {
    const customId = interaction.customId;

    // 1. Pack Selector
    if (customId === 'emoji_pack_select') {
      const packId = interaction.values[0];
      const pack = EMOJI_PACKS[packId];
      if (!pack) {
        return interaction.reply({ content: '❌ Invalid pack selected.', ephemeral: true });
      }

      const sessionId = this.createSession(interaction.user.id, interaction.guildId, pack.emojis, pack.name);
      const panel = this.buildSelectivePanel(sessionId, interaction.guild);

      return interaction.update({
        embeds: panel.embeds,
        components: panel.components
      });
    }

    // 2. Selective dropdown
    if (customId.startsWith('emoji_select_')) {
      const sessionId = customId.replace('emoji_select_', '');
      const session = sessions.get(sessionId);

      if (!session) {
        return interaction.reply({
          content: '⚠️ This emoji session has expired. Please run the command again.',
          ephemeral: true
        });
      }

      // Update selected indexes
      session.selectedIndexes = new Set(interaction.values.map(Number));

      const panel = this.buildSelectivePanel(sessionId, interaction.guild);
      return interaction.update({
        embeds: panel.embeds,
        components: panel.components
      });
    }
  }
};

module.exports = emojiManager;
