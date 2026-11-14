const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');
const { COLORS } = require('../../../shared/constants');
const { isOwnerOrAdmin } = require('../../../shared/permissionHelper');
const guildService = require('../../../shared/guildService');
const serverTagService = require('../../modules/serverTagService');

function formatStatusLabel(settings, roleValidation) {
  if (settings?.modules?.server_tag_role === false) return '🔴 Module Disabled (`/modules`)';
  if (!settings?.serverTagRole?.enabled) return '🔴 OFF (Disabled)';
  if (roleValidation && !roleValidation.valid) return '🟡 ON — Attention Needed';
  return '🟢 ON (Active)';
}

function buildStatusEmbed(guild, settings, tagInfo, roleValidation, syncResult = null) {
  const cfg = settings?.serverTagRole || {};
  const roleDisplay = cfg.roleId ? `<@&${cfg.roleId}> (\`${cfg.roleId}\`)` : '*Not configured*';
  const tagText = tagInfo?.tag
    ? `\`${tagInfo.tag}\` (Guild ID: \`${tagInfo.serverTagId || guild.id}\`)`
    : tagInfo?.supportsGuildTags
    ? `Server Tag enabled — awaiting first wearer in cache (Guild ID: \`${guild.id}\`)`
    : `Guild ID: \`${guild.id}\``;

  const activeCount = cfg.roleId && guild.roles.cache.has(cfg.roleId)
    ? guild.members.cache.filter(
        m => m.roles.cache.has(cfg.roleId) && (cfg.includeBots || !m.user.bot)
      ).size
    : (cfg.activeMemberCount || 0);

  const embed = new EmbedBuilder()
    .setColor(cfg.enabled && (!roleValidation || roleValidation.valid) ? COLORS.PRIMARY : COLORS.SECONDARY)
    .setTitle(`🏷️ Server Tag Auto Role — ${guild.name}`)
    .addFields(
      { name: 'Status', value: formatStatusLabel(settings, roleValidation), inline: true },
      { name: 'Reward Role', value: roleDisplay, inline: true },
      { name: 'Include Bots', value: cfg.includeBots ? 'Yes' : 'No', inline: true },
      { name: 'Server Tag Info', value: tagText, inline: false },
      { name: 'Members With Role', value: `${activeCount}`, inline: true },
      {
        name: 'Last Sync',
        value: cfg.lastSyncAt
          ? `${(cfg.lastSyncStatus || 'idle').toUpperCase()} (<t:${Math.floor(new Date(cfg.lastSyncAt).getTime() / 1000)}:R>)`
          : 'Never',
        inline: true
      }
    )
    .setFooter({ text: 'Use /servertag set @role • /servertag off • /servertag on • /servertag sync' })
    .setTimestamp();

  if (tagInfo?.badgeUrl) {
    embed.setThumbnail(tagInfo.badgeUrl);
  }

  if (roleValidation && !roleValidation.valid && cfg.roleId) {
    embed.addFields({ name: '⚠️ Permission / Hierarchy Warning', value: roleValidation.error, inline: false });
  }

  if (syncResult?.message) {
    embed.addFields({ name: 'Latest Sync Result', value: syncResult.message, inline: false });
  }

  return embed;
}

async function handleAction({ guild, caller, client, settings, action, role = null, includeBots = null }) {
  if (!isOwnerOrAdmin(caller, guild, client, settings)) {
    return {
      error: '🚫 Administrator, Server Owner, or Whitelisted permissions are required to configure Server Tag Auto Role.'
    };
  }

  const currentConfig = settings?.serverTagRole || {};
  const tagInfo = serverTagService.detectGuildServerTagInfo(guild, currentConfig);

  if (action === 'set') {
    if (!role) {
      return { error: '⚠️ Please specify a role (e.g. `/servertag set role:@AURA Member` or `+servertag set @AURA Member`).' };
    }

    const validation = await serverTagService.validateRoleConfiguration(guild, role.id);
    if (!validation.valid) {
      return { error: `❌ ${validation.error}` };
    }

    const nextIncludeBots = includeBots !== null ? includeBots : Boolean(currentConfig.includeBots);
    let updatedSettings = await guildService.updateSettings(guild.id, {
      'modules.server_tag_role': true,
      'serverTagRole.enabled': true,
      'serverTagRole.roleId': role.id,
      'serverTagRole.includeBots': nextIncludeBots,
      'serverTagRole.serverTagId': tagInfo.serverTagId || guild.id,
      'serverTagRole.detectedTag': tagInfo.tag || currentConfig.detectedTag || null,
      'serverTagRole.detectedBadge': tagInfo.badge || currentConfig.detectedBadge || null,
      'serverTagRole.updatedBy': caller.id,
      'serverTagRole.updatedAt': new Date()
    });

    const syncResult = await serverTagService.syncGuild(guild, updatedSettings, client, {
      source: 'commandSet',
      force: true
    });
    updatedSettings = await guildService.getSettings(guild.id);
    const freshTagInfo = serverTagService.detectGuildServerTagInfo(guild, updatedSettings?.serverTagRole);
    const embed = buildStatusEmbed(guild, updatedSettings, freshTagInfo, validation, syncResult)
      .setDescription(`✅ Server Tag Auto Role is now **ON** and linked to <@&${role.id}>.`);

    return { embeds: [embed] };
  }

  if (action === 'on' || action === 'enable') {
    if (!currentConfig.roleId) {
      return {
        error: '⚠️ No role is configured yet. Run `/servertag set role:@YourRole` first to choose which role tag adopters receive.'
      };
    }

    const validation = await serverTagService.validateRoleConfiguration(guild, currentConfig.roleId);
    if (!validation.valid) {
      return { error: `❌ Cannot enable Server Tag Auto Role: ${validation.error}` };
    }

    let updatedSettings = await guildService.updateSettings(guild.id, {
      'modules.server_tag_role': true,
      'serverTagRole.enabled': true,
      'serverTagRole.updatedBy': caller.id,
      'serverTagRole.updatedAt': new Date()
    });

    const syncResult = await serverTagService.syncGuild(guild, updatedSettings, client, {
      source: 'commandEnable',
      force: true
    });
    updatedSettings = await guildService.getSettings(guild.id);
    const freshTagInfo = serverTagService.detectGuildServerTagInfo(guild, updatedSettings?.serverTagRole);
    const embed = buildStatusEmbed(guild, updatedSettings, freshTagInfo, validation, syncResult)
      .setDescription(`✅ Server Tag Auto Role turned **ON** for <@&${currentConfig.roleId}>.`);

    return { embeds: [embed] };
  }

  if (action === 'off' || action === 'disable') {
    const updatedSettings = await guildService.updateSettings(guild.id, {
      'serverTagRole.enabled': false,
      'serverTagRole.updatedBy': caller.id,
      'serverTagRole.updatedAt': new Date()
    });

    serverTagService.emitDashboardUpdate(guild.id, client, {
      event: 'disabled',
      enabled: false
    });

    const embed = new EmbedBuilder()
      .setColor(COLORS.SECONDARY)
      .setTitle(`🛑 Server Tag Auto Role Turned OFF — ${guild.name}`)
      .setDescription(
        'Automatic Server Tag role assignment and removal is now **OFF**.\n' +
        'Your configured role has been kept saved so you can re-enable anytime with `/servertag on` or in the Web Dashboard.'
      )
      .setTimestamp();

    return { embeds: [embed] };
  }

  if (action === 'sync') {
    const syncResult = await serverTagService.syncGuild(guild, settings, client, {
      source: 'commandSync',
      force: true
    });
    if (!syncResult.success) {
      return { error: `❌ ${syncResult.error || syncResult.message || 'Synchronization failed.'}` };
    }

    const updatedSettings = await guildService.getSettings(guild.id);
    const roleValidation = updatedSettings?.serverTagRole?.roleId
      ? await serverTagService.validateRoleConfiguration(guild, updatedSettings.serverTagRole.roleId)
      : null;
    const freshTagInfo = serverTagService.detectGuildServerTagInfo(guild, updatedSettings?.serverTagRole);
    const embed = buildStatusEmbed(guild, updatedSettings, freshTagInfo, roleValidation, syncResult)
      .setDescription('🔄 Manual Server Tag synchronization completed.');

    return { embeds: [embed] };
  }

  // Default: status / view
  const roleValidation = currentConfig.roleId
    ? await serverTagService.validateRoleConfiguration(guild, currentConfig.roleId)
    : null;
  const embed = buildStatusEmbed(guild, settings, tagInfo, roleValidation);
  return { embeds: [embed] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('servertag')
    .setDescription('Configure automatic role rewards for members wearing this server\'s Discord Server Tag')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set the role to automatically assign/remove when members adopt or drop your server tag')
        .addRoleOption(opt =>
          opt.setName('role')
            .setDescription('Role to grant to members wearing this server tag')
            .setRequired(true)
        )
        .addBooleanOption(opt =>
          opt.setName('include_bots')
            .setDescription('Also assign the role to bot accounts (Default: False)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('on')
        .setDescription('Turn Server Tag Auto Role ON using your saved role')
    )
    .addSubcommand(sub =>
      sub.setName('off')
        .setDescription('Turn Server Tag Auto Role OFF')
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('View current Server Tag Auto Role status, detected tag, and member count')
    )
    .addSubcommand(sub =>
      sub.setName('sync')
        .setDescription('Immediately synchronize tag roles across all members')
    ),

  name: 'servertag',
  description: 'Configure automatic role rewards for Discord Server Tag wearers',
  aliases: ['tagrole', 'servertagrole', 'tagautorole'],
  module: 'server_tag_role',

  async execute(interaction, client, settings) {
    const sub = interaction.options.getSubcommand();
    const needsDefer = sub === 'set' || sub === 'on' || sub === 'sync';
    if (needsDefer) {
      await interaction.deferReply({ ephemeral: true });
    }

    const role = sub === 'set' ? interaction.options.getRole('role') : null;
    const includeBots = sub === 'set' ? interaction.options.getBoolean('include_bots') : null;

    const result = await handleAction({
      guild: interaction.guild,
      caller: interaction.member || interaction.user,
      client,
      settings,
      action: sub,
      role,
      includeBots
    });

    const payload = result.error
      ? { content: result.error, ephemeral: true }
      : { embeds: result.embeds, ephemeral: sub !== 'status' };

    if (needsDefer) {
      return interaction.editReply(payload);
    }
    return interaction.reply(payload);
  },

  async executePrefix(message, args, client, settings) {
    const subRaw = (args[0] || 'status').toLowerCase();
    let action = subRaw;
    let role = null;
    let includeBots = null;

    if (subRaw === 'enable') action = 'on';
    if (subRaw === 'disable' || subRaw === 'stop') action = 'off';
    if (subRaw === 'view') action = 'status';

    if (subRaw === 'set' || (message.mentions.roles.size > 0 && !['on', 'off', 'status', 'sync'].includes(subRaw))) {
      action = 'set';
      const roleArg = subRaw === 'set' ? args[1] : args[0];
      role =
        message.mentions.roles.first() ||
        (roleArg ? message.guild.roles.cache.get(roleArg.replace(/[<@&>]/g, '')) : null);

      const botFlagArg = args.find(a => a === '--bots' || a === 'bots=true');
      if (botFlagArg) includeBots = true;
    }

    const result = await handleAction({
      guild: message.guild,
      caller: message.member || message.author,
      client,
      settings,
      action,
      role,
      includeBots
    });

    if (result.error) {
      return message.reply(result.error);
    }
    return message.reply({ embeds: result.embeds });
  }
};
