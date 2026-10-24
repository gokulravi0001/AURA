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
    .setDescription(`AURA is your all-in-one powerhouse bot.\nAll features can be controlled with **Slash commands**, prefix **\`${prefix}\`**, or directly via the **Web Dashboard**!`)
    .addFields(
      {
        name: '📊 XP & Leveling',
        value: `\`${prefix}rank [user]\` • \`${prefix}leaderboard\` • \`${prefix}rewards [add/remove]\` • \`${prefix}addxp <@user> <amount>\` • \`${prefix}resetxp <@user|all>\` • \`${prefix}level-settings\``
      },
      {
        name: '🔊 Join-to-Create Voice Lounges',
        value: `\`${prefix}voice setup\` • \`${prefix}voice lock\` • \`${prefix}voice unlock\` • \`${prefix}voice hide\` • \`${prefix}voice show\` • \`${prefix}voice limit <n>\` • \`${prefix}voice rename <name>\` • \`${prefix}voice transfer <@user>\``
      },
      {
        name: '🎂 Birthdays',
        value: `\`${prefix}birthday view [@user]\` • \`${prefix}birthday <DD/MM>\` • \`${prefix}birthday list\` • \`${prefix}birthday remove\` • \`${prefix}birthday setup <#channel> [@role]\``
      },
      {
        name: '🎫 Support & Tickets',
        value: `\`${prefix}ticket panel [#channel]\` • \`${prefix}ticket setup <category> <role>\` • \`${prefix}close\` • \`${prefix}claim\``
      },
      {
        name: '📌 Sticky Messages & Image Threads',
        value: `\`${prefix}sticky <message>\` • \`${prefix}sticky list\` • \`${prefix}sticky remove\` • \`${prefix}threads setup <#channel>\``
      },
      {
        name: '🎮 Interactive Minigames',
        value: `\`${prefix}rps [@user]\` • \`${prefix}counting [setup <#channel>]\` • \`${prefix}wordchain [setup <#channel>]\``
      },
      {
        name: '🚀 Bump Automation & Reminders',
        value: `\`${prefix}bump\` • \`${prefix}bump done\` • \`${prefix}bump setup <#channel> [@role] [interval]\``
      },
      {
        name: '📈 Server Counters',
        value: `\`${prefix}counters setup\` • \`${prefix}counters update\` • \`${prefix}counters remove\``
      }
    )
    .setFooter({ text: `Type ${prefix}help or /help anytime • Prefix: ${prefix}` })
    .setTimestamp();
}

function buildHelpButtons() {
  const dashboardUrl = process.env.DASHBOARD_URL || 'https://aura-bot-dashboard.vercel.app';
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Open Web Dashboard')
      .setURL(dashboardUrl)
      .setStyle(ButtonStyle.Link)
      .setEmoji('🌐'),
    new ButtonBuilder()
      .setLabel('Invite AURA')
      .setURL(`https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID || '1550194365635362876'}&permissions=8&scope=bot%20applications.commands`)
      .setStyle(ButtonStyle.Link)
      .setEmoji('➕')
  );
}
