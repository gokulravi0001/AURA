const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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
   * Build the interactive Leveling Hub embed
   */
  async buildHubEmbed(guild, guildDoc, user, isAdmin) {
    const lev = guildDoc?.leveling || {};
    const isEnabled = lev.enabled !== false;
    const channelText = lev.announcementChannelId ? `<#${lev.announcementChannelId}>` : '*Current chat channel*';
    const rewardsCount = lev.roleRewards?.length || 0;

    // Caller's current user XP stats
    const userDoc = await UserXP.findOne({ guildId: guild.id, userId: user.id });
    const userLevel = userDoc?.level || 0;
    const userXp = userDoc?.xp || 0;
    const nextLevelXp = levelingService.getXpForLevel(userLevel);
    const percent = Math.min(100, Math.round((userXp / Math.max(1, nextLevelXp)) * 100));

    const totalBars = 10;
    const filledBars = Math.round((percent / 100) * totalBars);
    const progressBar = '▰'.repeat(filledBars) + '▱'.repeat(totalBars - filledBars);

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`🏆 Leveling & XP Hub — ${guild.name}`)
      .setDescription(
        `Welcome to the **Interactive Leveling System**! Chat to earn XP, climb the server leaderboard, and unlock custom role rewards.\n\n` +
        `### 📌 Server Leveling Status\n` +
        `• **System Status:** ${isEnabled ? '🟢 **Active**' : '🔴 **Disabled**'}\n` +
        `• **XP Rates:** \`${lev.xpMin || 15} - ${lev.xpMax || 25} XP\` per message • Cooldown: \`${lev.cooldownSeconds || 60}s\`\n` +
        `• **Level-Up Channel:** ${channelText}\n` +
        `• **Role Rewards:** \`${rewardsCount} role(s) configured\`\n\n` +
        `### 👤 Your Level Progress (<@${user.id}>)\n` +
        `• **Level:** **${userLevel}** • **XP:** \`${userXp.toLocaleString()} / ${nextLevelXp.toLocaleString()} XP\`\n` +
        `${progressBar} **${percent}%**\n\n` +
        `👇 **Select an option below to get started:**`
      )
      .addFields(
        {
          name: '🎮 Member Actions',
          value:
            '• **👤 My Rank:** View your detailed rank card, rank position & stats\n' +
            '• **🏆 Leaderboard:** See the top 10 most active members on the server\n' +
            '• **🎁 Role Rewards:** Check all roles unlocked by leveling up'
        }
      )
      .setFooter({ text: 'AURA Interactive Guide • Click buttons below to navigate' })
      .setTimestamp();

    if (isAdmin) {
      embed.addFields({
        name: '⚙️ Administrator Action Controls',
        value:
          '• **⚙️ Settings:** Toggle leveling ON/OFF or customize XP rates\n' +
          '• **🎖️ Reward Roles:** Add or remove role rewards for reaching specific levels\n' +
          '• **➕ Give XP:** Award custom XP directly to any server member\n' +
          '• **🔄 Reset XP:** Reset XP for a specific member or the whole server'
      });
    }

    return embed;
  },

  /**
   * Build action rows.
   * If user is not an administrator, the Admin Row is completely omitted!
   */
  buildHubComponents(isAdmin) {
    const components = [];

    // Row 1: Member Controls (Visible to EVERYONE)
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

    // Row 2: Administrator Controls (ONLY visible if user is an Administrator, Owner, Dev, or Trusted!)
    if (isAdmin) {
      const adminRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_level_setup')
          .setLabel('Settings & Rates')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⚙️'),
        new ButtonBuilder()
          .setCustomId('btn_level_addreward')
          .setLabel('Setup Reward Roles')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎖️'),
        new ButtonBuilder()
          .setCustomId('btn_level_addxp')
          .setLabel('Give XP')
          .setStyle(ButtonStyle.Success)
          .setEmoji('➕'),
        new ButtonBuilder()
          .setCustomId('btn_level_reset')
          .setLabel('Reset XP')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔄')
      );
      components.push(adminRow);
    }

    return components;
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
      const userDoc = await UserXP.findOne({ guildId: guild.id, userId: user.id }) || { xp: 0, level: 0, totalMessages: 0 };
      const rankCount = await UserXP.countDocuments({
        guildId: guild.id,
        $or: [
          { level: { $gt: userDoc.level } },
          { level: userDoc.level, xp: { $gt: userDoc.xp } }
        ]
      });
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
    }

    // 2. Leaderboard
    if (customId === 'btn_level_leaderboard') {
      const topUsers = await UserXP.find({ guildId: guild.id })
        .sort({ level: -1, xp: -1 })
        .limit(10);

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
    }

    // 3. Role Rewards
    if (customId === 'btn_level_rewards') {
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
    }

    // --- ADMINISTRATOR ONLY BUTTONS BELOW ---
    if (!isAdmin) {
      return interaction.reply({
        content: '🚫 This option is reserved for **Administrators**, **Server Owners**, and **Trusted Members**.',
        ephemeral: true
      });
    }

    // 4. Settings & Rates Menu
    if (customId === 'btn_level_setup') {
      const isEnabled = guildDoc.leveling?.enabled !== false;
      const embed = new EmbedBuilder()
        .setColor(COLORS.PRIMARY)
        .setTitle(`⚙️ Leveling Configuration — ${guild.name}`)
        .setDescription(
          `Current Status: ${isEnabled ? '🟢 **Enabled**' : '🔴 **Disabled**'}\n` +
          `XP per Message: \`${guildDoc.leveling.xpMin || 15} - ${guildDoc.leveling.xpMax || 25} XP\`\n` +
          `Cooldown: \`${guildDoc.leveling.cooldownSeconds || 60} seconds\`\n` +
          `Announcement Channel: ${guildDoc.leveling.announcementChannelId ? `<#${guildDoc.leveling.announcementChannelId}>` : '*Current Chat*'}\n\n` +
          `Use the buttons below to toggle leveling or change rates:`
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_level_toggle')
          .setLabel(isEnabled ? 'Disable Leveling' : 'Enable Leveling')
          .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
          .setEmoji(isEnabled ? '🔴' : '🟢'),
        new ButtonBuilder()
          .setCustomId('btn_level_open_rates')
          .setLabel('Change Rates & Cooldown')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⏱️'),
        new ButtonBuilder()
          .setCustomId('btn_level_refresh_hub')
          .setLabel('Back to Hub')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('↩️')
      );

      return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    // Toggle ON/OFF
    if (customId === 'btn_level_toggle') {
      const current = guildDoc.leveling?.enabled !== false;
      guildDoc.leveling.enabled = !current;
      await guildDoc.save();

      return interaction.reply({
        content: `✅ Leveling has been **${!current ? 'ENABLED' : 'DISABLED'}** on this server.`,
        ephemeral: true
      });
    }

    // Open Rates Modal
    if (customId === 'btn_level_open_rates') {
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
    }

    // 5. Setup Reward Roles Modal
    if (customId === 'btn_level_addreward') {
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
    }

    // 6. Give XP Modal
    if (customId === 'btn_level_addxp') {
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
    }

    // 7. Reset XP Modal
    if (customId === 'btn_level_reset') {
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
    }

    // Refresh hub
    if (customId === 'btn_level_refresh_hub') {
      const embed = await levelingHub.buildHubEmbed(guild, guildDoc, user, isAdmin);
      const components = levelingHub.buildHubComponents(isAdmin);
      return interaction.update({ embeds: [embed], components });
    }
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
      let leveledUp = false;
      while (userDoc.xp >= nextXp) {
        userDoc.xp -= nextXp;
        userDoc.level += 1;
        leveledUp = true;
        nextXp = levelingService.getXpForLevel(userDoc.level);
      }
      await userDoc.save();

      return interaction.reply({
        content: `✨ Awarded **${amount.toLocaleString()} XP** to <@${targetUser.id}>!\nNew Level: **${userDoc.level}** (Current XP: **${userDoc.xp}**)`,
        ephemeral: true
      });
    }

    // 4. Reset XP Modal
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
