const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');
const modulesCmd = require('./modules');

const data = new SlashCommandBuilder()
  .setName('features')
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
  );

module.exports = {
  data,
  name: 'features',
  description: 'Manage and toggle bot features selectively',
  aliases: [],
  permissions: [PermissionFlagsBits.Administrator],
  execute: modulesCmd.execute,
  executePrefix: modulesCmd.executePrefix,
  buildModulesPanel: modulesCmd.buildModulesPanel,
  MODULE_DEFINITIONS: modulesCmd.MODULE_DEFINITIONS,
  MODULE_ALIASES: modulesCmd.MODULE_ALIASES
};
