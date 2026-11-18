const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Explore all AURA commands and features'),
  name: 'help',
  description: 'Explore all AURA commands and features',
  aliases: ['h', 'commands'],

  async execute(interaction, client, settings) {
    const prefix = settings?.prefix || '+';
    const embed = buildHelpEmbed(prefix, client);
    const row = buildHelpButtons();
    return interaction.reply({ embeds: [embed], components: [row] });
  },

  async executePrefix(message, args, client, settings) {
    const prefix = settings?.prefix || '+';
    const embed = buildHelpEmbed(prefix, client);
    const row = buildHelpButtons();
    return message.reply({ embeds: [embed], components: [row] });
  }
};

function buildHelpEmbed(prefix, client) {
  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('⚡ AURA Command Menu')
    .setDescription(
      `All AURA capabilities are organized into **12 All-in-One Interactive Hubs**.\n` +
      `Type any command below (or use quick prefix shortcuts) to open interactive embeds with dropdowns and buttons!\n` +
      `*Administrator options and buttons are strictly filtered and only visible to staff.*`
    )
    .addFields(
      {
        name: '🏆 Leveling & XP Hub (`/level` • `+level`)',
        value: `*Slash:* \`/level\` • *Shortcuts:* \`${prefix}rank\`, \`${prefix}top\`, \`${prefix}addxp\`, \`${prefix}resetxp\`\nInteractive hub: view rank cards, leaderboard, configure level rewards, announcement channel, and XP rates.`
      },
      {
        name: '🎂 Birthdays Hub (`/bday` • `+bday`)',
        value: `*Slash:* \`/bday\` • *Shortcuts:* \`${prefix}bday set\`, \`${prefix}bday list\`, \`${prefix}bday setup\`\nInteractive hub: register birthdays, upcoming celebrations countdown, privacy input channels, and celebration roles.`
      },
      {
        name: '🔊 Voice & Lounges Hub (`/vc` • `+vc`)',
        value: `*Slash:* \`/vc\` • *Shortcuts:* \`${prefix}bounce\`, \`${prefix}massmove\`, \`${prefix}massdc\`\nInteractive hub: 1-click Join-to-Create setup, lounge controls (lock, unlock, hide, show, limit, rename), and voice bounce.`
      },
      {
        name: '🎫 Support & Tickets Hub (`/ticket` • `+ticket`)',
        value: `*Slash:* \`/ticket\` • *Shortcuts:* \`${prefix}ticket panel\`, \`${prefix}close\`, \`${prefix}claim\`\nInteractive hub: 1-click ticket panels, ticket manager, transcripts, claim/close workflows, and category settings.`
      },
      {
        name: '🛡️ Moderation & Protection Hub (`/mod` • `+mod`)',
        value: `*Slash:* \`/mod\` • *Shortcuts:* \`${prefix}purge\`, \`${prefix}autodlt\`, \`${prefix}sticky\`, \`${prefix}thread\`\nInteractive hub: bulk purge (presets or reply), 1s auto-delete duration, sticky messages, and image auto-threads.`
      },
      {
        name: '📈 Server Tools & Growth Hub (`/tools` • `+tools`)',
        value: `*Slash:* \`/tools\` • *Shortcuts:* \`${prefix}servertag\`, \`${prefix}counter\`, \`${prefix}invites\`, \`${prefix}inviterole\`\nInteractive hub: Discord Server Tag auto-roles & sync, voice member stat counters, invite tracking & inviter role guard.`
      },
      {
        name: '🎮 Minigames & Activities Hub (`/games` • `+games`)',
        value: `*Slash:* \`/games\` • *Shortcuts:* \`${prefix}rps\`, \`${prefix}trivia\`, \`${prefix}count\`, \`${prefix}chain\`, \`${prefix}bump\`\nInteractive hub: play Rock-Paper-Scissors, timed Trivia, Counting & Word Chain streaks, and bump reminders.`
      },
      {
        name: '✨ Emoji Stealer & Packs Hub (`/emoji` • `+emoji`)',
        value: `*Slash:* \`/emoji\` • *Shortcuts:* \`${prefix}addemj\` *(reply to steal emojis)*, \`${prefix}steal\`, \`${prefix}massadd\`\nInteractive hub: Mass steal emojis from replies/messages, selective emoji picker, and curated aesthetic emoji packs.`
      },
      {
        name: '⚙️ Modular Feature Controls (`/modules` • `+modules`)',
        value: `*Slash:* \`/modules\` • *Shortcuts:* \`${prefix}modules\`, \`${prefix}modules toggle <name>\`\nInteractive hub: selectively toggle any bot module on or off with interactive dropdown menus and buttons.`
      },
      {
        name: '⭐ Trusted Members Management (`/trusted` • `+trusted`)',
        value: `*Slash:* \`/trusted\` • *Shortcuts:* \`${prefix}trusted set @user\`, \`${prefix}trusted list\`\nInteractive hub: grant full immunity from disruptive commands and full command access without needing admin permissions.`
      },
      {
        name: '👑 System Diagnostics & Controls (`/system` • `+system`)',
        value: `*Slash:* \`/system\` • *Shortcuts:* \`${prefix}ping\`, \`${prefix}stats\`, \`${prefix}maintenance\`, \`${prefix}blacklist\`\nInteractive hub: WebSocket ping, database health, memory heap, developer maintenance mode, and blacklist management.`
      },
      {
        name: '⚡ Master Help Guide (`/help` • `+help`)',
        value: `*Slash:* \`/help\` • *Shortcuts:* \`${prefix}help\`, \`${prefix}commands\`\nDisplays this comprehensive command menu and guidance hub overview.`
      }
    )
    .setFooter({ text: `Type ${prefix}help or /help anytime • Prefix: ${prefix}` })
    .setTimestamp();
}

function buildHelpButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Invite AURA')
      .setURL(`https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID || '1550194365635362876'}&permissions=8&scope=bot%20applications.commands`)
      .setStyle(ButtonStyle.Link)
      .setEmoji('➕')
  );
}
