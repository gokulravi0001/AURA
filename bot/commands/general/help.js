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
    .setTitle('⚡ AURA Command Menu')
    .setDescription(`All commands are short and fast to use with **\`${prefix}\`** or **Slash commands** (\`/\`).\nClick the button below to open the Web Dashboard anytime!`)
    .addFields(
      {
        name: '🎂 Birthdays (Auto-Delete & DM Confirmation)',
        value: `\`${prefix}bday <DD/MM/YYYY>\` • \`${prefix}bday setuser @user <DD/MM/YYYY> [tz]\` • \`${prefix}bday view [@user]\` • \`${prefix}bday list\` • \`${prefix}bday setup <#wish> [#set]\`\n*Supports saving birthdays for yourself or others with timezones! In the input channel, typing \`DD/MM/YYYY\` auto-deletes for privacy.*`
      },
      {
        name: '🔊 Voice Lounges & Voice Actions (Bounce, Move, DC, Mute)',
        value: `\`${prefix}vc setup\` • \`${prefix}bounce @user\` • \`${prefix}massmove <#to>\` • \`${prefix}massdc [#chan]\` • \`${prefix}massmute [#chan]\` • \`${prefix}massunmute [#chan]\` • \`${prefix}vc panel\`\n*Use \`${prefix}bounce @user\` to move a member across all voice channels one by one in seconds!*`
      },
      {
        name: '📊 XP & Leveling',
        value: `\`${prefix}rank [@user]\` • \`${prefix}top\` • \`${prefix}reward [add/remove]\` • \`${prefix}addxp @user <n>\` • \`${prefix}resetxp @user\` • \`${prefix}levels\``
      },
      {
        name: '🎫 Support & Tickets',
        value: `\`${prefix}ticket panel\` • \`${prefix}ticket setup <cat> <role>\` • \`${prefix}close\` • \`${prefix}claim\``
      },
      {
        name: '📌 Sticky Messages & Image Threads',
        value: `\`${prefix}sticky <text>\` • \`${prefix}sticky list\` • \`${prefix}sticky remove\` • \`${prefix}thread setup <#chan>\``
      },
      {
        name: '📈 Server Counters & Invite Tracker',
        value: `\`${prefix}inv [@user]\` • \`${prefix}inv top\` • \`${prefix}inv setup <#chan>\` • \`${prefix}counter setup\` • \`${prefix}counter update\``
      },
      {
        name: '🎮 Games & Bumping',
        value: `\`${prefix}rps [@user]\` • \`${prefix}trivia\` • \`${prefix}count [setup #chan]\` • \`${prefix}chain [setup #chan]\` • \`${prefix}bump [done|setup]\``
      },
      {
        name: '✨ Emoji Stealer & Curated Packs (Mass & Selective Add)',
        value: `\`${prefix}steal <emojis...>\` • \`${prefix}massadd <emojis...>\` • \`${prefix}emoji packs\` • \`${prefix}emoji add <url> [name]\` • \`${prefix}emoji list\`\n*Mass add all detected emojis or selectively pick via interactive dropdown! Reply to any message with \`${prefix}steal\` to extract its emojis.*`
      },
      {
        name: '🧹 Chat Moderation & Purge (Reply to Purge)',
        value: `\`${prefix}purge\` *(reply to a message to purge everything after it)* • \`${prefix}purge include\` • \`${prefix}purge <amount> [@user|bots]\` • \`${prefix}clear\`\n*Quickly clean up chat: reply to any message with \`${prefix}purge\` and AURA deletes all messages sent after it!*`
      },
      {
        name: '⚙️ Modular Feature Controls (Turn Features ON/OFF)',
        value: `\`${prefix}modules\` • \`${prefix}modules on <feature|all>\` • \`${prefix}modules off <feature|all>\` • \`${prefix}modules toggle <feature>\`\n*Interactively enable or disable any bot feature selectively with dropdown menus & buttons!*`
      },
      {
        name: '🛡️ Whitelist (Bypass Admin Permissions)',
        value: `\`${prefix}whitelist add @user\` • \`${prefix}whitelist remove @user\` • \`${prefix}whitelist list\` • \`${prefix}whitelist clear\`\n*Whitelist members so they can run all commands without needing Discord Administrator permissions! (Owner & Bot Dev only)*`
      },
      {
        name: '🔒 Inviter Role Guard (Exclusive Invite Generation)',
        value: `\`${prefix}inviterole set @role\` • \`${prefix}inviterole view\` • \`${prefix}inviterole sync\` • \`${prefix}inviterole clean\` • \`${prefix}inviterole disable\`\n*Locks invite creation exclusively to the designated role! Denies @everyone from creating invites, intercepts and deletes unauthorized invite links instantly, and blocks chat invite links.*`
      }
    )
    .setFooter({ text: `Type ${prefix}help or /help anytime • Prefix: ${prefix}` })
    .setTimestamp();
}

function buildHelpButtons() {
  const dashboardUrl = process.env.DASHBOARD_URL || 'https://dashboard-alpha-lovat.vercel.app';
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
