const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const guildService = require('../../../shared/guildService');
const { COLORS } = require('../../../shared/constants');

const MODULE_DEFINITIONS = [
  { key: 'leveling', name: 'XP & Leveling System', emoji: '🏆', desc: 'Chat XP, member ranks, and role rewards' },
  { key: 'join_to_create', name: 'Join-to-Create Voice', emoji: '🔊', desc: 'Temporary custom voice channels & control panel' },
  { key: 'tickets', name: 'Ticket Support Desk', emoji: '🎫', desc: 'Support ticket panels & private channels' },
  { key: 'voice_counters', name: 'Server Voice Counters', emoji: '📊', desc: 'Live member, bot, and voice stat channels' },
  { key: 'birthdays', name: 'Birthday System', emoji: '🎂', desc: 'Birthday registration, auto-delete & wishes' },
  { key: 'sticky_messages', name: 'Sticky Messages', emoji: '📌', desc: 'Keeps important notices pinned at the bottom' },
  { key: 'image_threads', name: 'Auto Image Threads', emoji: '💬', desc: 'Automatic discussion threads on image posts' },
  { key: 'minigames', name: 'Interactive Minigames', emoji: '🎮', desc: 'Counting, Word Chain, Trivia & RPS' },
  { key: 'bump_reminder', name: 'Bump Reminder', emoji: '⏰', desc: 'Tracks Disboard bump timers & sends reminders' },
  { key: 'invite_tracker', name: 'Invite Tracker', emoji: '📈', desc: 'Tracks who invited members, leaves & alts' }
];

const MODULE_ALIASES = {
  leveling: 'leveling', levels: 'leveling', xp: 'leveling', rank: 'leveling',
  voice: 'join_to_create', tempvoice: 'join_to_create', vc: 'join_to_create', join_to_create: 'join_to_create', jointocreate: 'join_to_create',
  ticket: 'tickets', tickets: 'tickets', support: 'tickets',
  counter: 'voice_counters', counters: 'voice_counters', voice_counters: 'voice_counters', voicecounters: 'voice_counters',
  birthday: 'birthdays', birthdays: 'birthdays', bday: 'birthdays',
  sticky: 'sticky_messages', sticky_messages: 'sticky_messages', stickymessages: 'sticky_messages',
  thread: 'image_threads', threads: 'image_threads', image_threads: 'image_threads', imagethreads: 'image_threads',
  games: 'minigames', minigames: 'minigames', counting: 'minigames', wordchain: 'minigames',
  bump: 'bump_reminder', bump_reminder: 'bump_reminder', bumpreminder: 'bump_reminder',
  invites: 'invite_tracker', invite: 'invite_tracker', invite_tracker: 'invite_tracker', invitetracker: 'invite_tracker'
};

function buildModulesPanel(settings, guild) {
  const modules = settings?.modules || {};

  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`⚙️ Server Features & Modules — ${guild.name}`)
    .setDescription(
      'Turn features **ON** or **OFF** selectively using the dropdown menu or buttons below.\n' +
      'Disabled modules will not run commands or process automated events.\n\n' +
      MODULE_DEFINITIONS.map(mod => {
        const isEnabled = modules[mod.key] !== false;
        const statusBadge = isEnabled ? '🟢 **ENABLED**' : '🔴 **DISABLED**';
        return `${mod.emoji} **${mod.name}**\n↳ Status: ${statusBadge} • *${mod.desc}*`;
      }).join('\n\n')
    )
    .setFooter({ text: 'AURA Modular Management • Administrators only' })
    .setTimestamp();

  // String Select Menu
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_module_toggle')
    .setPlaceholder('🔘 Select a feature to toggle ON / OFF...')
    .addOptions(
      MODULE_DEFINITIONS.map(mod => {
        const isEnabled = modules[mod.key] !== false;
        return new StringSelectMenuOptionBuilder()
          .setLabel(mod.name)
          .setValue(mod.key)
          .setDescription(isEnabled ? 'Currently: ENABLED (Click to turn OFF)' : 'Currently: DISABLED (Click to turn ON)')
          .setEmoji(isEnabled ? '🟢' : '🔴');
      })
    );

  const row1 = new ActionRowBuilder().addComponents(selectMenu);

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_modules_enable_all')
      .setLabel('Turn ON All')
      .setEmoji('🟢')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_modules_disable_all')
      .setLabel('Turn OFF All')
      .setEmoji('🔴')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('btn_modules_refresh')
      .setLabel('Refresh')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modules')
    .setDescription('Selectively enable, disable, or manage server features (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('menu')
        .setDescription('Open the interactive features toggle menu with select dropdown & buttons')
    )
    .addSubcommand(sub =>
      sub.setName('enable')
        .setDescription('Enable a specific feature or all features')
        .addStringOption(opt =>
          opt.setName('feature')
            .setDescription('The feature to enable')
            .setRequired(true)
            .addChoices(
              { name: 'All Features', value: 'all' },
              { name: '🏆 XP & Leveling', value: 'leveling' },
              { name: '🔊 Join-to-Create Voice', value: 'join_to_create' },
              { name: '🎫 Ticket Support Desk', value: 'tickets' },
              { name: '📊 Server Voice Counters', value: 'voice_counters' },
              { name: '🎂 Birthday System', value: 'birthdays' },
              { name: '📌 Sticky Messages', value: 'sticky_messages' },
              { name: '💬 Auto Image Threads', value: 'image_threads' },
              { name: '🎮 Minigames', value: 'minigames' },
              { name: '⏰ Bump Reminder', value: 'bump_reminder' },
              { name: '📈 Invite Tracker', value: 'invite_tracker' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Disable a specific feature or all features')
        .addStringOption(opt =>
          opt.setName('feature')
            .setDescription('The feature to disable')
            .setRequired(true)
            .addChoices(
              { name: 'All Features', value: 'all' },
              { name: '🏆 XP & Leveling', value: 'leveling' },
              { name: '🔊 Join-to-Create Voice', value: 'join_to_create' },
              { name: '🎫 Ticket Support Desk', value: 'tickets' },
              { name: '📊 Server Voice Counters', value: 'voice_counters' },
              { name: '🎂 Birthday System', value: 'birthdays' },
              { name: '📌 Sticky Messages', value: 'sticky_messages' },
              { name: '💬 Auto Image Threads', value: 'image_threads' },
              { name: '🎮 Minigames', value: 'minigames' },
              { name: '⏰ Bump Reminder', value: 'bump_reminder' },
              { name: '📈 Invite Tracker', value: 'invite_tracker' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('toggle')
        .setDescription('Toggle a specific feature ON or OFF')
        .addStringOption(opt =>
          opt.setName('feature')
            .setDescription('The feature to toggle')
            .setRequired(true)
            .addChoices(
              { name: '🏆 XP & Leveling', value: 'leveling' },
              { name: '🔊 Join-to-Create Voice', value: 'join_to_create' },
              { name: '🎫 Ticket Support Desk', value: 'tickets' },
              { name: '📊 Server Voice Counters', value: 'voice_counters' },
              { name: '🎂 Birthday System', value: 'birthdays' },
              { name: '📌 Sticky Messages', value: 'sticky_messages' },
              { name: '💬 Auto Image Threads', value: 'image_threads' },
              { name: '🎮 Minigames', value: 'minigames' },
              { name: '⏰ Bump Reminder', value: 'bump_reminder' },
              { name: '📈 Invite Tracker', value: 'invite_tracker' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('View the current ON/OFF status of all server features')
    ),
  name: 'modules',
  description: 'Manage and toggle bot features selectively',
  aliases: ['module', 'feature', 'features', 'toggle'],
  permissions: [PermissionFlagsBits.Administrator],

  async execute(interaction, client, settings) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '🚫 Administrator permission required.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // 1. MENU or LIST
    if (sub === 'menu' || sub === 'list') {
      const currentSettings = await guildService.getSettings(guildId);
      const panel = buildModulesPanel(currentSettings, interaction.guild);
      return interaction.reply({ embeds: panel.embeds, components: panel.components });
    }

    // 2. ENABLE
    if (sub === 'enable') {
      const feature = interaction.options.getString('feature');
      if (feature === 'all') {
        const updateData = {};
        MODULE_DEFINITIONS.forEach(m => { updateData[`modules.${m.key}`] = true; });
        const updated = await guildService.updateSettings(guildId, updateData);
        const panel = buildModulesPanel(updated, interaction.guild);
        return interaction.reply({
          content: '🟢 **All features have been successfully enabled!**',
          embeds: panel.embeds,
          components: panel.components
        });
      }

      const updateData = { [`modules.${feature}`]: true };
      const updated = await guildService.updateSettings(guildId, updateData);
      const def = MODULE_DEFINITIONS.find(m => m.key === feature);
      return interaction.reply({
        content: `🟢 Successfully **ENABLED** feature: **${def?.name || feature}**! Use \`/modules\` to view the panel.`
      });
    }

    // 3. DISABLE
    if (sub === 'disable') {
      const feature = interaction.options.getString('feature');
      if (feature === 'all') {
        const updateData = {};
        MODULE_DEFINITIONS.forEach(m => { updateData[`modules.${m.key}`] = false; });
        const updated = await guildService.updateSettings(guildId, updateData);
        const panel = buildModulesPanel(updated, interaction.guild);
        return interaction.reply({
          content: '🔴 **All features have been successfully disabled!**',
          embeds: panel.embeds,
          components: panel.components
        });
      }

      const updateData = { [`modules.${feature}`]: false };
      const updated = await guildService.updateSettings(guildId, updateData);
      const def = MODULE_DEFINITIONS.find(m => m.key === feature);
      return interaction.reply({
        content: `🔴 Successfully **DISABLED** feature: **${def?.name || feature}**! Use \`/modules\` to view the panel.`
      });
    }

    // 4. TOGGLE
    if (sub === 'toggle') {
      const feature = interaction.options.getString('feature');
      const currentSettings = await guildService.getSettings(guildId);
      const currentStatus = currentSettings.modules?.[feature] !== false;
      const newStatus = !currentStatus;

      const updateData = { [`modules.${feature}`]: newStatus };
      await guildService.updateSettings(guildId, updateData);
      const def = MODULE_DEFINITIONS.find(m => m.key === feature);

      return interaction.reply({
        content: `${newStatus ? '🟢 **ENABLED**' : '🔴 **DISABLED**'} feature: **${def?.name || feature}**!`
      });
    }
  },

  async executePrefix(message, args, client, settings) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('🚫 Administrator permission required.');
    }

    const action = args[0]?.toLowerCase();
    const rawTarget = args[1]?.toLowerCase();
    const guildId = message.guild.id;

    // +modules on/enable <feature|all>
    if (action === 'on' || action === 'enable') {
      if (!rawTarget) {
        return message.reply('❌ Please specify a feature to enable or `all`. Example: `+modules on leveling` or `+modules on all`');
      }

      if (rawTarget === 'all') {
        const updateData = {};
        MODULE_DEFINITIONS.forEach(m => { updateData[`modules.${m.key}`] = true; });
        const updated = await guildService.updateSettings(guildId, updateData);
        const panel = buildModulesPanel(updated, message.guild);
        return message.reply({
          content: '🟢 **All features have been successfully enabled!**',
          embeds: panel.embeds,
          components: panel.components
        });
      }

      const resolved = MODULE_ALIASES[rawTarget];
      if (!resolved) {
        return message.reply(`❌ Unknown feature: \`${rawTarget}\`. Valid options: \`${MODULE_DEFINITIONS.map(m => m.key).join(', ')}\`, or \`all\`.`);
      }

      const updateData = { [`modules.${resolved}`]: true };
      const updated = await guildService.updateSettings(guildId, updateData);
      const def = MODULE_DEFINITIONS.find(m => m.key === resolved);
      return message.reply(`🟢 Successfully **ENABLED** feature: **${def?.name || resolved}**!`);
    }

    // +modules off/disable <feature|all>
    if (action === 'off' || action === 'disable') {
      if (!rawTarget) {
        return message.reply('❌ Please specify a feature to disable or `all`. Example: `+modules off leveling` or `+modules off all`');
      }

      if (rawTarget === 'all') {
        const updateData = {};
        MODULE_DEFINITIONS.forEach(m => { updateData[`modules.${m.key}`] = false; });
        const updated = await guildService.updateSettings(guildId, updateData);
        const panel = buildModulesPanel(updated, message.guild);
        return message.reply({
          content: '🔴 **All features have been successfully disabled!**',
          embeds: panel.embeds,
          components: panel.components
        });
      }

      const resolved = MODULE_ALIASES[rawTarget];
      if (!resolved) {
        return message.reply(`❌ Unknown feature: \`${rawTarget}\`. Valid options: \`${MODULE_DEFINITIONS.map(m => m.key).join(', ')}\`, or \`all\`.`);
      }

      const updateData = { [`modules.${resolved}`]: false };
      const updated = await guildService.updateSettings(guildId, updateData);
      const def = MODULE_DEFINITIONS.find(m => m.key === resolved);
      return message.reply(`🔴 Successfully **DISABLED** feature: **${def?.name || resolved}**!`);
    }

    // +modules toggle <feature>
    if (action === 'toggle') {
      if (!rawTarget) {
        return message.reply('❌ Please specify a feature to toggle. Example: `+modules toggle leveling`');
      }

      const resolved = MODULE_ALIASES[rawTarget];
      if (!resolved) {
        return message.reply(`❌ Unknown feature: \`${rawTarget}\`. Valid options: \`${MODULE_DEFINITIONS.map(m => m.key).join(', ')}\`.`);
      }

      const currentSettings = await guildService.getSettings(guildId);
      const currentStatus = currentSettings.modules?.[resolved] !== false;
      const newStatus = !currentStatus;

      const updateData = { [`modules.${resolved}`]: newStatus };
      await guildService.updateSettings(guildId, updateData);
      const def = MODULE_DEFINITIONS.find(m => m.key === resolved);
      return message.reply(`${newStatus ? '🟢 **ENABLED**' : '🔴 **DISABLED**'} feature: **${def?.name || resolved}**!`);
    }

    // Default: Display interactive control panel (+modules or +features or +modules list)
    const currentSettings = await guildService.getSettings(guildId);
    const panel = buildModulesPanel(currentSettings, message.guild);
    return message.reply({ embeds: panel.embeds, components: panel.components });
  },

  buildModulesPanel,
  MODULE_DEFINITIONS,
  MODULE_ALIASES
};
