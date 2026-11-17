const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField
} = require('discord.js');
const Guild = require('../../models/Guild');
const UserXP = require('../../models/UserXP');
const levelingService = require('./levelingService');
const immunityService = require('../../shared/immunityService');
const { COLORS } = require('../../shared/constants');
const { isOwnerOrAdmin } = require('../../shared/permissionHelper');

const levelingHub = {
  /**
   * Build the complete, minimal, and ultra-interactive Leveling Hub embed
   */
  async buildHubEmbed(guild, guildDoc, user, isAdmin) {
    const lev = guildDoc?.leveling || {};
    const isEnabled = lev.enabled !== false;
    const channelText = lev.announcementChannelId
      ? `<#${lev.announcementChannelId}>`
      : '`Current chat channel` *(Where member chats)*';

    const rewards = lev.roleRewards || [];
    let rewardsText = '';
    if (rewards.length > 0) {
      rewardsText = rewards.slice(0, 4).map(r => `• **Level ${r.level}** ➔ <@&${r.roleId}>`).join('\n');
      if (rewards.length > 4) {
        rewardsText += `\n*+${rewards.length - 4} more configured roles (click Rewards to view)*`;
      }
    } else {
      rewardsText = '*No role rewards configured yet.*';
    }

    // Server-wide leveling analytics
    const totalRanked = await UserXP.countDocuments({ guildId: guild.id }).catch(() => 0);
    const topQuery = UserXP.findOne({ guildId: guild.id });
    const topUserDoc = typeof topQuery?.sort === 'function' ? await topQuery.sort({ level: -1, xp: -1 }).catch(() => null) : await topQuery;
    const topUserText = topUserDoc ? `<@${topUserDoc.userId}> \`[Level ${topUserDoc.level}]\`` : '*No chatters yet*';

    // Caller's current user XP progress
    const userDoc = await UserXP.findOne({ guildId: guild.id, userId: user.id }).catch(() => null);
    const userLevel = userDoc?.level || 0;
    const userXp = userDoc?.xp || 0;
    const nextLevelXp = levelingService.getXpForLevel(userLevel);
    const remainingXp = Math.max(0, nextLevelXp - userXp);
    const percent = Math.min(100, Math.round((userXp / Math.max(1, nextLevelXp)) * 100));

    const totalBars = 10;
    const filledBars = Math.round((percent / 100) * totalBars);
    const progressBar = '▰'.repeat(filledBars) + '▱'.repeat(totalBars - filledBars);

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`🏆 Leveling & XP System — ${guild.name}`)
      .setDescription(
        `Chat in text channels to earn XP, climb the server leaderboard, and unlock milestone roles.\n` +
        `Use the interactive dropdown or quick action buttons below to manage and view everything!`
      )
      .addFields(
        {
          name: '⚙️ Server Leveling Setup',
          value:
            `• **System Status:** ${isEnabled ? '🟢 **Active** `[Gaining XP]`' : '🔴 **Disabled** `[XP Paused]`'}\n` +
            `• **XP Rates:** \`${lev.xpMin || 15} - ${lev.xpMax || 25} XP\` per message\n` +
            `• **Chat Cooldown:** \`${lev.cooldownSeconds || 60} seconds\` between messages\n` +
            `• **Level-Up Channel:** ${channelText}\n` +
            `• **Community Stats:** \`${totalRanked} members ranked\` • Top: ${topUserText}`
        },
        {
          name: `🎖️ Milestone Role Rewards (${rewards.length})`,
          value: rewardsText
        },
        {
          name: `👤 Your Level Progress (<@${user.id}>)`,
          value:
            `• **Level:** **${userLevel}** • **XP:** \`${userXp.toLocaleString()} / ${nextLevelXp.toLocaleString()} XP\`\n` +
            `${progressBar} **${percent}%** *(Need **${remainingXp.toLocaleString()} XP** for Level ${userLevel + 1})*`
        }
      )
      .setFooter({ text: 'AURA Leveling Suite • Live interactive configuration' })
      .setTimestamp();

    if (isAdmin) {
      embed.addFields({
        name: '🛡️ Administrator Controls Enabled',
        value: 'You have full access to change settings, toggle ON/OFF, set channels, assign reward roles, and grant/reset member XP below.'
      });
    }

    return embed;
  },

  /**
   * Build interactive components.
   * Admin actions are strictly omitted if the user is not an administrator/trusted member.
   */
  buildHubComponents(isAdmin, guildDoc = null) {
    const isEnabled = guildDoc?.leveling?.enabled !== false;
    const components = [];

    // Row 1: Interactive Dropdown Menu
    const selectOptions = [
      new StringSelectMenuOptionBuilder()
        .setValue('act_myrank')
        .setLabel('My Rank Card')
        .setDescription('View your level, rank position and XP stats')
        .setEmoji('👤'),
      new StringSelectMenuOptionBuilder()
        .setValue('act_leaderboard')
        .setLabel('Server Leaderboard')
        .setDescription('View the top 10 most active members')
        .setEmoji('🏆'),
      new StringSelectMenuOptionBuilder()
        .setValue('act_rewards')
        .setLabel('View Role Rewards')
        .setDescription('View all roles awarded at specific levels')
        .setEmoji('🎁')
    ];

    if (isAdmin) {
      selectOptions.push(
        new StringSelectMenuOptionBuilder()
          .setValue('act_toggle')
          .setLabel(isEnabled ? 'Disable Leveling System' : 'Enable Leveling System')
          .setDescription(isEnabled ? 'Pause XP gain server-wide' : 'Resume XP gain server-wide')
          .setEmoji(isEnabled ? '🔴' : '🟢'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_channel_picker')
          .setLabel('Set Announcement Channel')
          .setDescription('Choose where level-up celebrations post')
          .setEmoji('📢'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_rates')
          .setLabel('Configure XP Rates')
          .setDescription('Customize min/max XP and spam cooldown')
          .setEmoji('⏱️'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_add_reward')
          .setLabel('Add/Remove Reward Roles')
          .setDescription('Assign or remove level milestone roles')
          .setEmoji('🎖️'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_give_xp')
          .setLabel('Grant XP to Member')
          .setDescription('Award custom XP to a user')
          .setEmoji('➕'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_deduct_xp')
          .setLabel('Deduct XP from Member')
          .setDescription('Remove XP from a user')
          .setEmoji('➖'),
        new StringSelectMenuOptionBuilder()
          .setValue('act_reset_xp')
          .setLabel('Reset Member or Server XP')
          .setDescription('Reset levels for a user or entire server')
          .setEmoji('🔄')
      );
    }

    const dropdown = new StringSelectMenuBuilder()
      .setCustomId('select_level_action')
      .setPlaceholder('⚡ Select an action or setting to configure...')
      .addOptions(selectOptions);

    components.push(new ActionRowBuilder().addComponents(dropdown));

    // Row 2: Member Action Buttons (Visible to everyone)
    const memberRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_level_myrank')
        .setLabel('My Rank')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('👤'),
      new ButtonBuilder()
        .setCustomId('btn_level_leaderboard')
        .setLabel('Leaderboard')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🏆'),
      new ButtonBuilder()
        .setCustomId('btn_level_rewards')
        .setLabel('Role Rewards')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎁')
    );
    components.push(memberRow);

    // Row 3: Admin Quick Settings Buttons (ONLY visible to Admins/Owners/Trusted)
    if (isAdmin) {
      const adminConfigRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_level_toggle')
          .setLabel(isEnabled ? 'Active: ON' : 'Paused: OFF')
          .setStyle(isEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
          .setEmoji(isEnabled ? '🟢' : '🔴'),
        new ButtonBuilder()
          .setCustomId('btn_level_channel_prompt')
          .setLabel('Channel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📢'),
        new ButtonBuilder()
          .setCustomId('btn_level_open_rates')
          .setLabel('XP Rates')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⏱️'),
        new ButtonBuilder()
          .setCustomId('btn_level_addreward')
          .setLabel('Setup Rewards')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎖️')
      );
      components.push(adminConfigRow);

      // Row 4: Admin XP Moderation Tools
      const adminToolsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_level_addxp')
          .setLabel('Give XP')
          .setStyle(ButtonStyle.Success)
          .setEmoji('➕'),
        new ButtonBuilder()
          .setCustomId('btn_level_deductxp')
          .setLabel('Deduct XP')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('➖'),
        new ButtonBuilder()
          .setCustomId('btn_level_reset')
          .setLabel('Reset XP')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔄')
      );
      components.push(adminToolsRow);
    }

    return components;
  },

  /**
   * Handle dropdown select menu: select_level_action
   */
  async handleSelectMenu(interaction, client) {
    const value = interaction.values[0];
    const guild = interaction.guild;
    const user = interaction.user;
    let guildDoc = await Guild.findOne({ guildId: guild.id });
    if (!guildDoc) guildDoc = await Guild.create({ guildId: guild.id });

    const isAdmin = isOwnerOrAdmin(interaction.member || interaction.user, guild, client);

    // 1. Member actions
    if (value === 'act_myrank') {
      return this.sendRankCard(interaction, guild, user);
    }
    if (value === 'act_leaderboard') {
      return this.sendLeaderboard(interaction, guild);
    }
    if (value === 'act_rewards') {
      return this.sendRewards(interaction, guild, guildDoc);
    }

    // 2. Admin actions
    if (!isAdmin) {
      return interaction.reply({
        content: '🚫 This option is reserved for **Administrators**, **Server Owners**, and **Trusted Members**.',
        ephemeral: true
      });
    }

    if (value === 'act_toggle') {
      const current = guildDoc.leveling?.enabled !== false;
      guildDoc.leveling.enabled = !current;
      await guildDoc.save();

      const embed = await this.buildHubEmbed(guild, guildDoc, user, isAdmin);
      const components = this.buildHubComponents(isAdmin, guildDoc);
      return interaction.update({ embeds: [embed], components });
    }

    if (value === 'act_channel_picker') {
      return this.sendChannelPicker(interaction, guild, guildDoc);
    }

    if (value === 'act_rates') {
      return this.showRatesModal(interaction, guildDoc);
    }

    if (value === 'act_add_reward') {
      return this.showRewardModal(interaction);
    }

    if (value === 'act_give_xp') {
      return this.showGiveXpModal(interaction);
    }

    if (value === 'act_deduct_xp') {
      return this.showDeductXpModal(interaction);
    }

    if (value === 'act_reset_xp') {
      return this.showResetXpModal(interaction);
    }
  },

  /**
   * Handle channel select menu: select_level_channel
   */
  async handleChannelSelect(interaction, client) {
    const guild = interaction.guild;
    const user = interaction.user;
    const isAdmin = isOwnerOrAdmin(interaction.member || interaction.user, guild, client);

    if (!isAdmin) {
      return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
    }

    const selectedChannelId = interaction.values[0];
    let guildDoc = await Guild.findOne({ guildId: guild.id });
    if (!guildDoc) guildDoc = await Guild.create({ guildId: guild.id });

    guildDoc.leveling.announcementChannelId = selectedChannelId;
    await guildDoc.save();

    await interaction.reply({
      content: `📢 Level-up celebration messages will now be posted in <#${selectedChannelId}>!`,
      ephemeral: true
    });
  },

  /**
   * Handle all button interactions starting with btn_level_
   */
  async handleButton(interaction, client) {
    const customId = interaction.customId;
    const guild = interaction.guild;
    const user = interaction.user;
    let guildDoc = await Guild.findOne({ guildId: guild.id });
    if (!guildDoc) guildDoc = await Guild.create({ guildId: guild.id });

    const isAdmin = isOwnerOrAdmin(interaction.member || interaction.user, guild, client);

    // 1. My Rank Card
    if (customId === 'btn_level_myrank') {
      return this.sendRankCard(interaction, guild, user);
    }

    // 2. Leaderboard
    if (customId === 'btn_level_leaderboard') {
      return this.sendLeaderboard(interaction, guild);
    }

    // 3. Role Rewards
    if (customId === 'btn_level_rewards') {
      return this.sendRewards(interaction, guild, guildDoc);
    }

    // --- ADMINISTRATOR ONLY BUTTONS BELOW ---
    if (!isAdmin) {
      return interaction.reply({
        content: '🚫 This option is reserved for **Administrators**, **Server Owners**, and **Trusted Members**.',
        ephemeral: true
      });
    }

    // Toggle ON/OFF (Live update)
    if (customId === 'btn_level_toggle') {
      const current = guildDoc.leveling?.enabled !== false;
      guildDoc.leveling.enabled = !current;
      await guildDoc.save();

      const embed = await this.buildHubEmbed(guild, guildDoc, user, isAdmin);
      const components = this.buildHubComponents(isAdmin, guildDoc);
      return interaction.update({ embeds: [embed], components });
    }

    // Channel Picker Prompt
    if (customId === 'btn_level_channel_prompt') {
      return this.sendChannelPicker(interaction, guild, guildDoc);
    }

    // Reset Channel to Chat
    if (customId === 'btn_level_channel_reset') {
      guildDoc.leveling.announcementChannelId = null;
      await guildDoc.save();

      return interaction.reply({
        content: '📢 Level-up celebration messages will now be posted in the channel where the user chats.',
        ephemeral: true
      });
    }

    // Open Rates Modal
    if (customId === 'btn_level_open_rates') {
      return this.showRatesModal(interaction, guildDoc);
    }

    // Setup Reward Roles Modal
    if (customId === 'btn_level_addreward') {
      return this.showRewardModal(interaction);
    }

    // Give XP Modal
    if (customId === 'btn_level_addxp') {
      return this.showGiveXpModal(interaction);
    }

    // Deduct XP Modal
    if (customId === 'btn_level_deductxp') {
      return this.showDeductXpModal(interaction);
    }

    // Reset XP Modal
    if (customId === 'btn_level_reset') {
      return this.showResetXpModal(interaction);
    }

    // Refresh hub
    if (customId === 'btn_level_refresh_hub') {
      const embed = await this.buildHubEmbed(guild, guildDoc, user, isAdmin);
      const components = this.buildHubComponents(isAdmin, guildDoc);
      return interaction.update({ embeds: [embed], components });
    }
  },

  /**
   * Helper: Send personal rank card
   */
  async sendRankCard(interaction, guild, user) {
    const userDoc = await UserXP.findOne({ guildId: guild.id, userId: user.id }).catch(() => null) || { xp: 0, level: 0, totalMessages: 0 };
    const rankCount = await UserXP.countDocuments({
      guildId: guild.id,
      $or: [
        { level: { $gt: userDoc.level } },
        { level: userDoc.level, xp: { $gt: userDoc.xp } }
      ]
    }).catch(() => 0);
    const rank = rankCount + 1;
    const nextLevelXp = levelingService.getXpForLevel(userDoc.level);
    const percent = Math.min(100, Math.round((userDoc.xp / Math.max(1, nextLevelXp)) * 100));
    const totalBars = 14;
    const filledBars = Math.round((percent / 100) * totalBars);
    const progressBar = '▰'.repeat(filledBars) + '▱'.repeat(totalBars - filledBars);

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setAuthor({ name: `${user.username}'s Rank Card`, iconURL: user.displayAvatarURL({ dynamic: true }) })
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '🏆 Rank', value: `#**${rank}**`, inline: true },
        { name: '⭐ Level', value: `**${userDoc.level}**`, inline: true },
        { name: '💬 Messages', value: `**${userDoc.totalMessages || 0}**`, inline: true },
        { name: 'XP Progress', value: `${progressBar} **${percent}%**\n\`${userDoc.xp.toLocaleString()} / ${nextLevelXp.toLocaleString()} XP\`` }
      )
      .setFooter({ text: `${guild.name} • Chat to level up!`, iconURL: guild.iconURL({ dynamic: true }) })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },

  /**
   * Helper: Send Top 10 leaderboard
   */
  async sendLeaderboard(interaction, guild) {
    const topUsers = await UserXP.find({ guildId: guild.id })
      .sort({ level: -1, xp: -1 })
      .limit(10)
      .catch(() => []);

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`🏆 Top Members Leaderboard — ${guild.name}`)
      .setFooter({ text: 'Top 10 Ranked Members • Chat to gain XP!' })
      .setTimestamp();

    if (!topUsers.length) {
      embed.setDescription('No members have earned XP on this server yet. Start chatting to gain XP!');
    } else {
      const medals = ['🥇', '🥈', '🥉'];
      let desc = '';
      for (let i = 0; i < topUsers.length; i++) {
        const record = topUsers[i];
        const medal = medals[i] || `\`#${i + 1}\``;
        desc += `${medal} <@${record.userId}> • **Level ${record.level}** (${record.xp.toLocaleString()} XP)\n`;
      }
      embed.setDescription(desc);
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },

  /**
   * Helper: Send role rewards list
   */
  async sendRewards(interaction, guild, guildDoc) {
    const rewards = guildDoc.leveling?.roleRewards || [];
    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`🎁 Level Role Rewards — ${guild.name}`)
      .setFooter({ text: 'Level up by chatting to automatically unlock these roles!' })
      .setTimestamp();

    if (!rewards.length) {
      embed.setDescription('No role rewards have been configured yet. Administrators can add rewards using **Setup Reward Roles**!');
    } else {
      const desc = rewards.map(r => `• **Level ${r.level}** ➔ <@&${r.roleId}>`).join('\n');
      embed.setDescription(desc);
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },

  /**
   * Helper: Send native channel picker select menu
   */
  async sendChannelPicker(interaction, guild, guildDoc) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle('📢 Configure Level-Up Announcement Channel')
      .setDescription(
        'Select a channel below to send level-up celebrations, or click **Post in Current Chat**:\n\n' +
        `Current Setting: ${guildDoc.leveling.announcementChannelId ? `<#${guildDoc.leveling.announcementChannelId}>` : '`Current chat channel`'}`
      );

    const channelSelect = new ChannelSelectMenuBuilder()
      .setCustomId('select_level_channel')
      .setPlaceholder('📢 Choose a channel from your server...')
      .setChannelTypes(ChannelType.GuildText);

    const row1 = new ActionRowBuilder().addComponents(channelSelect);
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_level_channel_reset')
        .setLabel('Post in Current Chat (Default)')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💬')
    );

    return interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
  },

  /**
   * Modal Showers
   */
  showRatesModal(interaction, guildDoc) {
    const modal = new ModalBuilder()
      .setCustomId('modal_level_rates')
      .setTitle('Configure Leveling Rates');

    const minInput = new TextInputBuilder()
      .setCustomId('min_xp')
      .setLabel('Minimum XP per message')
      .setStyle(TextInputStyle.Short)
      .setValue(String(guildDoc.leveling.xpMin || 15))
      .setRequired(true);

    const maxInput = new TextInputBuilder()
      .setCustomId('max_xp')
      .setLabel('Maximum XP per message')
      .setStyle(TextInputStyle.Short)
      .setValue(String(guildDoc.leveling.xpMax || 25))
      .setRequired(true);

    const cooldownInput = new TextInputBuilder()
      .setCustomId('cooldown_sec')
      .setLabel('Cooldown between messages (seconds, min 5)')
      .setStyle(TextInputStyle.Short)
      .setValue(String(guildDoc.leveling.cooldownSeconds || 60))
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(minInput),
      new ActionRowBuilder().addComponents(maxInput),
      new ActionRowBuilder().addComponents(cooldownInput)
    );

    return interaction.showModal(modal);
  },

  showRewardModal(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('modal_level_reward')
      .setTitle('Configure Level Role Rewards');

    const levelInput = new TextInputBuilder()
      .setCustomId('reward_level')
      .setLabel('Level Requirement (e.g. 5, 10, 20)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('5')
      .setRequired(true);

    const roleInput = new TextInputBuilder()
      .setCustomId('reward_role')
      .setLabel('Role Name, ID, or @mention')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('123456789012345678')
      .setRequired(true);

    const actionInput = new TextInputBuilder()
      .setCustomId('reward_action')
      .setLabel('Action: "add" or "remove"')
      .setStyle(TextInputStyle.Short)
      .setValue('add')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(levelInput),
      new ActionRowBuilder().addComponents(roleInput),
      new ActionRowBuilder().addComponents(actionInput)
    );

    return interaction.showModal(modal);
  },

  showGiveXpModal(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('modal_level_give_xp')
      .setTitle('Grant XP to Member');

    const userInput = new TextInputBuilder()
      .setCustomId('target_user')
      .setLabel('User ID or @mention')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('123456789012345678')
      .setRequired(true);

    const amountInput = new TextInputBuilder()
      .setCustomId('xp_amount')
      .setLabel('Amount of XP to grant')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('500')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(userInput),
      new ActionRowBuilder().addComponents(amountInput)
    );

    return interaction.showModal(modal);
  },

  showDeductXpModal(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('modal_level_deduct_xp')
      .setTitle('Deduct XP from Member');

    const userInput = new TextInputBuilder()
      .setCustomId('target_user')
      .setLabel('User ID or @mention')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('123456789012345678')
      .setRequired(true);

    const amountInput = new TextInputBuilder()
      .setCustomId('xp_amount')
      .setLabel('Amount of XP to deduct')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('250')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(userInput),
      new ActionRowBuilder().addComponents(amountInput)
    );

    return interaction.showModal(modal);
  },

  showResetXpModal(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('modal_level_reset_xp')
      .setTitle('Reset Member or Server XP');

    const targetInput = new TextInputBuilder()
      .setCustomId('reset_target')
      .setLabel('Target: User ID, @mention, or type "server"')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Type user ID, @user, or server')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(targetInput)
    );

    return interaction.showModal(modal);
  },

  /**
   * Handle modal submissions
   */
  async handleModal(interaction, client) {
    const customId = interaction.customId;
    const guild = interaction.guild;
    const caller = interaction.member || interaction.user;

    if (!isOwnerOrAdmin(caller, guild, client)) {
      return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
    }

    let guildDoc = await Guild.findOne({ guildId: guild.id });
    if (!guildDoc) guildDoc = await Guild.create({ guildId: guild.id });

    // 1. Rates Modal
    if (customId === 'modal_level_rates') {
      const min = parseInt(interaction.fields.getTextInputValue('min_xp'), 10);
      const max = parseInt(interaction.fields.getTextInputValue('max_xp'), 10);
      const cooldown = parseInt(interaction.fields.getTextInputValue('cooldown_sec'), 10);

      if (isNaN(min) || isNaN(max) || isNaN(cooldown) || min <= 0 || max < min || cooldown < 5) {
        return interaction.reply({
          content: '❌ Invalid rates. Min XP must be > 0, Max XP >= Min, and Cooldown >= 5 seconds.',
          ephemeral: true
        });
      }

      guildDoc.leveling.xpMin = min;
      guildDoc.leveling.xpMax = max;
      guildDoc.leveling.cooldownSeconds = cooldown;
      await guildDoc.save();

      return interaction.reply({
        content: `✅ Updated leveling rates: **${min} - ${max} XP** per message, Cooldown: **${cooldown}s**.`,
        ephemeral: true
      });
    }

    // 2. Reward Role Modal
    if (customId === 'modal_level_reward') {
      const level = parseInt(interaction.fields.getTextInputValue('reward_level'), 10);
      const roleRaw = interaction.fields.getTextInputValue('reward_role').replace(/[<@&>]/g, '').trim();
      const action = interaction.fields.getTextInputValue('reward_action').toLowerCase().trim();

      if (isNaN(level) || level <= 0) {
        return interaction.reply({ content: '❌ Level must be a positive number.', ephemeral: true });
      }

      const role = guild.roles.cache.get(roleRaw) || guild.roles.cache.find(r => r.name.toLowerCase() === roleRaw.toLowerCase());
      if (!role && action !== 'remove') {
        return interaction.reply({ content: '❌ Role not found on this server. Check role ID or name.', ephemeral: true });
      }

      let rewards = guildDoc.leveling.roleRewards || [];

      if (action === 'remove') {
        guildDoc.leveling.roleRewards = rewards.filter(r => r.level !== level);
        await guildDoc.save();
        return interaction.reply({
          content: `🗑️ Removed level **${level}** role reward.`,
          ephemeral: true
        });
      }

      rewards = rewards.filter(r => r.level !== level);
      rewards.push({ level, roleId: role.id });
      rewards.sort((a, b) => a.level - b.level);
      guildDoc.leveling.roleRewards = rewards;
      await guildDoc.save();

      return interaction.reply({
        content: `🎉 Successfully configured role reward: Level **${level}** ➔ <@&${role.id}>!`,
        ephemeral: true
      });
    }

    // 3. Give XP Modal
    if (customId === 'modal_level_give_xp') {
      const targetRaw = interaction.fields.getTextInputValue('target_user').replace(/[<@!>]/g, '').trim();
      const amount = parseInt(interaction.fields.getTextInputValue('xp_amount'), 10);

      if (isNaN(amount) || amount <= 0) {
        return interaction.reply({ content: '❌ XP amount must be a positive number.', ephemeral: true });
      }

      const targetUser = await client.users.fetch(targetRaw).catch(() => null);
      if (!targetUser) {
        return interaction.reply({ content: '❌ Target user not found. Provide a valid User ID or mention.', ephemeral: true });
      }

      let userDoc = await UserXP.findOne({ guildId: guild.id, userId: targetUser.id });
      if (!userDoc) {
        userDoc = new UserXP({ guildId: guild.id, userId: targetUser.id, xp: 0, level: 0 });
      }

      userDoc.xp += amount;
      let nextXp = levelingService.getXpForLevel(userDoc.level);
      while (userDoc.xp >= nextXp) {
        userDoc.xp -= nextXp;
        userDoc.level += 1;
        nextXp = levelingService.getXpForLevel(userDoc.level);
      }
      await userDoc.save();

      return interaction.reply({
        content: `✨ Awarded **${amount.toLocaleString()} XP** to <@${targetUser.id}>!\nNew Level: **${userDoc.level}** (Current XP: **${userDoc.xp}**)`,
        ephemeral: true
      });
    }

    // 4. Deduct XP Modal
    if (customId === 'modal_level_deduct_xp') {
      const targetRaw = interaction.fields.getTextInputValue('target_user').replace(/[<@!>]/g, '').trim();
      const amount = parseInt(interaction.fields.getTextInputValue('xp_amount'), 10);

      if (isNaN(amount) || amount <= 0) {
        return interaction.reply({ content: '❌ XP amount must be a positive number.', ephemeral: true });
      }

      const targetUser = await client.users.fetch(targetRaw).catch(() => null);
      if (!targetUser) {
        return interaction.reply({ content: '❌ Target user not found. Provide a valid User ID or mention.', ephemeral: true });
      }

      let userDoc = await UserXP.findOne({ guildId: guild.id, userId: targetUser.id });
      if (!userDoc) {
        userDoc = new UserXP({ guildId: guild.id, userId: targetUser.id, xp: 0, level: 0 });
      }

      userDoc.xp = Math.max(0, userDoc.xp - amount);
      await userDoc.save();

      return interaction.reply({
        content: `➖ Deducted **${amount.toLocaleString()} XP** from <@${targetUser.id}>.\nCurrent XP: **${userDoc.xp}** (Level **${userDoc.level}**)`,
        ephemeral: true
      });
    }

    // 5. Reset XP Modal
    if (customId === 'modal_level_reset_xp') {
      const targetRaw = interaction.fields.getTextInputValue('reset_target').trim();

      if (targetRaw.toLowerCase() === 'server' || targetRaw.toLowerCase() === 'all') {
        const result = await UserXP.deleteMany({
          guildId: guild.id,
          userId: { $ne: immunityService.ABSOLUTE_IMMUNE_USER_ID }
        });
        return interaction.reply({
          content: `⚠️ Successfully reset XP and levels for **${result.deletedCount} members** across the entire server. *(Immune developers protected)*`,
          ephemeral: true
        });
      }

      const targetId = targetRaw.replace(/[<@!>]/g, '').trim();
      if (immunityService.isImmune(targetId, guild, client)) {
        return interaction.reply({
          content: `🛡️ **Immunity Protected**: <@${targetId}> possesses Immunity and their XP cannot be reset.`,
          ephemeral: true
        });
      }

      await UserXP.deleteOne({ guildId: guild.id, userId: targetId });
      return interaction.reply({
        content: `🔄 Reset XP and level for <@${targetId}> back to **Level 0 (0 XP)**.`,
        ephemeral: true
      });
    }
  }
};

module.exports = levelingHub;
