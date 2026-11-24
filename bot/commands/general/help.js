const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { COLORS } = require('../../../shared/constants');
const guildService = require('../../../shared/guildService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Explore all AURA slash and prefix commands'),
  name: 'help',
  description: 'Explore all AURA commands and features',
  aliases: ['h', 'commands', 'cmd', 'cmds'],

  async execute(interaction, client, settings) {
    const prefix = settings?.prefix || '+';
    const embed = buildInitialHelpEmbed(prefix);
    const row = buildInitialButtons();
    return interaction.reply({ embeds: [embed], components: [row] });
  },

  async executePrefix(message, args, client, settings) {
    const prefix = settings?.prefix || '+';
    const choice = args[0]?.toLowerCase();

    if (choice === 'prefix' || choice === '+' || choice === 'text') {
      const embed = buildPrefixHelpEmbed(prefix);
      const row = buildPrefixButtons();
      return message.reply({ embeds: [embed], components: [row] });
    }

    if (choice === 'slash' || choice === '/' || choice === 'hub' || choice === 'hubs') {
      const embed = buildSlashHelpEmbed(prefix);
      const row = buildSlashButtons();
      return message.reply({ embeds: [embed], components: [row] });
    }

    const embed = buildInitialHelpEmbed(prefix);
    const row = buildInitialButtons();
    return message.reply({ embeds: [embed], components: [row] });
  },

  /**
   * Handle button interactions for the help menu
   */
  async handleButton(interaction, client) {
    const customId = interaction.customId;
    const settings = interaction.guildId ? await guildService.getSettings(interaction.guildId) : null;
    const prefix = settings?.prefix || '+';

    if (customId === 'btn_help_slash') {
      const embed = buildSlashHelpEmbed(prefix);
      const row = buildSlashButtons();
      return interaction.update({ embeds: [embed], components: [row] });
    }

    if (customId === 'btn_help_prefix') {
      const embed = buildPrefixHelpEmbed(prefix);
      const row = buildPrefixButtons();
      return interaction.update({ embeds: [embed], components: [row] });
    }

    if (customId === 'btn_help_home') {
      const embed = buildInitialHelpEmbed(prefix);
      const row = buildInitialButtons();
      return interaction.update({ embeds: [embed], components: [row] });
    }
  },

  // Export builders for unit tests
  buildInitialHelpEmbed,
  buildSlashHelpEmbed,
  buildPrefixHelpEmbed,
  buildInitialButtons,
  buildSlashButtons,
  buildPrefixButtons
};

// 1. Initial 2-Option Selection Embed
function buildInitialHelpEmbed(prefix) {
  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('⚡ AURA Command Directory & Guide')
    .setDescription(
      `Welcome to **AURA**! Choose which command directory you want to view:\n\n` +
      `⚡ **Option 1: Slash Commands (\`/\`)**\n` +
      `• Browse the **12 All-in-One Category Hubs** with interactive buttons, dropdown menus, and popup modals.\n\n` +
      `➕ **Option 2: Prefix Commands (\`+\`)**\n` +
      `• Browse all fast text shortcuts for quick chatting, moderation, voice control, leveling, and server management.\n\n` +
      `*Click one of the two buttons below to view the full command list!*`
    )
    .addFields(
      {
        name: '📌 Current Server Prefix',
        value: `\`${prefix}\` *(e.g. \`${prefix}help\`, \`${prefix}rank\`, \`${prefix}purge\`, \`${prefix}vcstatus\`)*`,
        inline: true
      },
      {
        name: '🛡️ Role Permissions',
        value: 'Administrator & setup options are strictly filtered and visible only to staff.',
        inline: true
      }
    )
    .setFooter({ text: `Type ${prefix}help or /help anytime • Prefix: ${prefix}` })
    .setTimestamp();
}

function buildInitialButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_help_slash')
      .setLabel('⚡ Slash Commands (/)')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_help_prefix')
      .setLabel('➕ Prefix Commands (+)')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setLabel('Invite AURA')
      .setURL(`https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID || '1550194365635362876'}&permissions=8&scope=bot%20applications.commands`)
      .setStyle(ButtonStyle.Link)
      .setEmoji('🔗')
  );
}

// 2. Slash Commands (/) Embed
function buildSlashHelpEmbed(prefix) {
  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('⚡ AURA — Slash Commands (/) Hubs (A-Z)')
    .setDescription(
      `All AURA slash capabilities are organized into **12 Clean Category Hubs** in alphabetical order.\n` +
      `Simply type the command below and hit Enter to open its interactive embed with buttons and dropdowns!\n` +
      `*Administrator options and buttons are strictly filtered and only visible to staff.*`
    )
    .addFields(
      {
        name: '🎂 Birthdays (`/bday`)',
        value: 'Interactive hub: register birthday via popup modal, upcoming celebrations countdown, privacy input channels, and celebration roles.'
      },
      {
        name: '✨ Emoji Stealer & Packs (`/emoji`)',
        value: 'Interactive hub: selective emoji steal, server emoji capacity slots, and curated aesthetic emoji packs.'
      },
      {
        name: '🎮 Minigames & Bump (`/games`)',
        value: 'Interactive hub: play Rock-Paper-Scissors, timed Trivia, Counting & Word Chain streaks, and Disboard bump reminders.'
      },
      {
        name: '⚡ Master Guide (`/help`)',
        value: 'Direct command: open this interactive command directory.'
      },
      {
        name: '🏆 Leveling & XP (`/level`)',
        value: 'Interactive hub: view rank cards, leaderboard, configure level rewards, announcement channel, and XP rates.'
      },
      {
        name: '🛡️ Moderation & Protection (`/mod`)',
        value: 'Interactive hub: bulk purge (presets: 10, 25, 50, 100 or reply purge), 1s auto-delete duration, sticky messages, and image auto-threads.'
      },
      {
        name: '⚙️ Feature Modules (`/modules`)',
        value: 'Interactive hub: selectively toggle any bot module on or off with interactive dropdown menus and buttons.'
      },
      {
        name: '👑 System Diagnostics (`/system`)',
        value: 'Direct hub: WebSocket ping, database latency, server count, uptime, and memory heap.'
      },
      {
        name: '🎫 Support Tickets (`/ticket`)',
        value: 'Interactive hub: 1-click support ticket button panels, ticket manager, transcripts, claim/close workflows, and category settings.'
      },
      {
        name: '📈 Server Tools & Growth (`/tools`)',
        value: 'Interactive hub: Discord Server Tag auto-roles & sync, voice member stat counters, invite tracking & inviter role guard.'
      },
      {
        name: '⭐ Trusted Members (`/trusted`)',
        value: 'Interactive hub: grant full immunity from disruptive commands and full command access without needing admin permissions.'
      },
      {
        name: '🔊 Voice & Lounges (`/vc`)',
        value: 'Interactive hub: **24/7 Permanent VC Status & Live Online/Member Counts**, 1-click Join-to-Create setup, temporary lounge controls (lock, unlock, hide, limit, rename), and voice bounce.'
      }
    )
    .setFooter({ text: `Alphabetical Order • Switch options below or type ${prefix}help` })
    .setTimestamp();
}

function buildSlashButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_help_prefix')
      .setLabel('➕ View Prefix Commands (+)')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_help_home')
      .setLabel('🏠 Main Menu')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel('Invite AURA')
      .setURL(`https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID || '1550194365635362876'}&permissions=8&scope=bot%20applications.commands`)
      .setStyle(ButtonStyle.Link)
      .setEmoji('🔗')
  );
}

// 3. Prefix Commands (+) Embed
function buildPrefixHelpEmbed(prefix) {
  return new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle(`➕ AURA — Fast Prefix Commands (${prefix}) (A-Z)`)
    .setDescription(
      `Fast text shortcuts in alphabetical order for quick chatting and immediate execution in server channels!\n` +
      `Current server prefix is **\`${prefix}\`**.`
    )
    .addFields(
      {
        name: '🎂 Birthdays',
        value: `\`${prefix}bday list\` • \`${prefix}bday remove\` • \`${prefix}bday set <DD/MM/YYYY>\` • \`${prefix}bday setup <#wish> [#input] [@role]\` • \`${prefix}bday view [@user]\``
      },
      {
        name: '✨ Emoji Stealer',
        value: `\`${prefix}addemj\` *(reply to steal target & below emojis)* • \`${prefix}emoji list\` • \`${prefix}emoji packs\` • \`${prefix}massadd <emojis...>\` • \`${prefix}steal <emojis...>\``
      },
      {
        name: '🏆 Leveling & XP',
        value: `\`${prefix}addxp @user <n>\` • \`${prefix}level [view|channel|rates]\` • \`${prefix}rank [@user]\` • \`${prefix}resetxp [@user]\` • \`${prefix}top\``
      },
      {
        name: '🎮 Minigames & Bumping',
        value: `\`${prefix}bump [done|setup]\` • \`${prefix}chain setup <#chan>\` • \`${prefix}count setup <#chan>\` • \`${prefix}rps [@user]\` • \`${prefix}trivia\``
      },
      {
        name: '🛡️ Moderation & Chat Protection',
        value: `\`${prefix}autodlt @user <duration> [#chan]\` • \`${prefix}autodlt stop @user\` • \`${prefix}purge <amount>\` • \`${prefix}purge\` *(reply to purge messages sent after)* • \`${prefix}sticky <text>\` • \`${prefix}thread setup <#chan>\``
      },
      {
        name: '⚙️ Modular Feature Controls',
        value: `\`${prefix}modules\` • \`${prefix}modules off <feature|all>\` • \`${prefix}modules on <feature|all>\` • \`${prefix}modules toggle <feature>\``
      },
      {
        name: '📈 Server Tools & Growth',
        value: `\`${prefix}counter setup\` • \`${prefix}counter update\` • \`${prefix}inv top\` • \`${prefix}inviterole set @role\` • \`${prefix}invites [@user]\` • \`${prefix}servertag [set @role|on|off|sync|status]\``
      },
      {
        name: '🎫 Support & Tickets',
        value: `\`${prefix}claim\` • \`${prefix}close\` • \`${prefix}ticket panel\` • \`${prefix}ticket setup <#cat> [@role]\``
      },
      {
        name: '👑 System & Diagnostics',
        value: `\`${prefix}blacklist [add|remove|list]\` • \`${prefix}maintenance [on|off|status]\` • \`${prefix}ping\` • \`${prefix}stats\` • \`${prefix}system\``
      },
      {
        name: '⭐ Trusted Members',
        value: `\`${prefix}trusted clear\` • \`${prefix}trusted list\` • \`${prefix}trusted remove @user\` • \`${prefix}trusted set @user\``
      },
      {
        name: '🔊 Voice & Lounges',
        value: `\`${prefix}bounce @user [rounds]\` • \`${prefix}massdc [#vc]\` • \`${prefix}massmove <#to> [#from]\` • \`${prefix}massmute [#vc]\` • \`${prefix}vc [lock|unlock|hide|show|limit|rename|panel]\` • \`${prefix}vc setup\` • \`${prefix}vc status [#vc] <text>\` • \`${prefix}vcstatus [text|stats <e1> <e2>]\` *(Live Online & Member Counts VC Status)*`
      }
    )
    .setFooter({ text: `Alphabetical Order • Switch options below or type ${prefix}help` })
    .setTimestamp();
}

function buildPrefixButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_help_slash')
      .setLabel('⚡ View Slash Commands (/)')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_help_home')
      .setLabel('🏠 Main Menu')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel('Invite AURA')
      .setURL(`https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID || '1550194365635362876'}&permissions=8&scope=bot%20applications.commands`)
      .setStyle(ButtonStyle.Link)
      .setEmoji('🔗')
  );
}
