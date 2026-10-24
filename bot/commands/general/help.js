const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Explore all AURA commands, features, and dashboard link'),
  name: 'help',
  description: 'Explore all AURA commands, features, and dashboard link',
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
    .setTitle('⚡ AURA Multipurpose Bot & Web Dashboard')
    .setDescription(`AURA is your server's all-in-one powerhouse bot.\nAll features can be controlled with **Slash commands**, prefix **\`${prefix}\`**, or directly via the **Web Dashboard**!`)
    .addFields(
      {
        name: '📊 Leveling & XP',
        value: `\`${prefix}rank [user]\` | \`${prefix}leaderboard\` | \`${prefix}addxp <@user> <amount>\`\n*Custom XP rates, role rewards, and rank cards.*`
      },
      {
        name: '🔊 Join-to-Create Voice',
        value: `\`${prefix}voice-lock\` | \`${prefix}voice-unlock\` | \`${prefix}voice-limit <num>\`\n*Auto-generated voice lounges with creator controls.*`
      },
      {
        name: '🎫 Ticket Support',
        value: `\`${prefix}ticket-panel\` | \`${prefix}close\`\n*Private channels, transcripts saved to database, staff claiming.*`
      },
      {
        name: '📌 Sticky Messages & Threads',
        value: `\`${prefix}sticky-set <message>\` | \`${prefix}sticky-remove\`\n*Auto-reposting sticky messages and automatic image threads.*`
      },
      {
        name: '🎂 Birthdays',
        value: `\`${prefix}birthday\` | \`${prefix}birthdays-upcoming\`\n*Celebrations, automatic wishes, and optional birthday role.*`
      },
      {
        name: '🎮 Minigames',
        value: `\`${prefix}rps [@user]\` | \`${prefix}counting-setup\` | \`${prefix}wordchain-setup\`\n*Live counting channel and word chain with streak tracking.*`
      },
      {
        name: '🚀 Bump Reminder',
        value: `\`${prefix}bump-status\` | \`${prefix}bump-setup\`\n*Compliant automatic Disboard detection and scheduled pings.*`
      },
      {
        name: '📈 Server Counters',
        value: `\`${prefix}counters-setup\`\n*Live stats voice channels for total members, humans, bots, and voice active.*`
      }
    )
    .setFooter({ text: `Type ${prefix}help or /help anytime • Prefix: ${prefix}` })
    .setTimestamp();
}

function buildHelpButtons() {
  const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:5173';
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Open Dashboard')
      .setURL(dashboardUrl)
      .setStyle(ButtonStyle.Link)
      .setEmoji('🌐'),
    new ButtonBuilder()
      .setLabel('Invite AURA')
      .setURL(`https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID || '123456789'}&permissions=8&scope=bot%20applications.commands`)
      .setStyle(ButtonStyle.Link)
      .setEmoji('➕')
  );
}
