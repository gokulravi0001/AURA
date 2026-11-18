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
      `All features in AURA are simplified into **All-in-One Interactive Guidance Hubs**.\n` +
      `Simply type the hub command (or click buttons/dropdowns in chat) to manage everything!\n` +
      `*Administrator options and buttons are strictly filtered and only visible to staff.*`
    )
    .addFields(
      {
        name: '🏆 Leveling & XP Hub (`/levels` • `+level`)',
        value: `\`${prefix}levels\` • \`${prefix}rank [@user]\` • \`${prefix}top\` • \`${prefix}addxp @user <n>\` • \`${prefix}resetxp @user\`\n*Interactive hub: view rank card, server leaderboard, role rewards, configure XP rates & announcement channel.*`
      },
      {
        name: '🎂 Birthdays Hub (`/bday` • `+bday`)',
        value: `\`${prefix}bday\` • \`${prefix}bday <DD/MM/YYYY>\` • \`${prefix}bday view [@user]\` • \`${prefix}bday list\` • \`${prefix}bday setup\`\n*Interactive hub: register birthday modal, upcoming countdowns, auto-delete input channel for privacy, and midnight celebration role.*`
      },
      {
        name: '🔊 Voice & Lounges Hub (`/vc` • `+vc`)',
        value: `\`${prefix}vc\` • \`${prefix}bounce @user\` • \`${prefix}massmove <#to>\` • \`${prefix}massdc [#chan]\` • \`${prefix}massmute [#chan]\` • \`${prefix}vc panel\`\n*Interactive hub: 1-click Join-to-Create setup, lounge controls (lock, unlock, hide, show, limit, rename), mass move, mass disconnect, and voice bounce!*`
      },
      {
        name: '🎫 Support & Tickets Hub (`/ticket` • `+ticket`)',
        value: `\`${prefix}ticket\` • \`${prefix}ticket panel\` • \`${prefix}ticket setup <cat> <role>\` • \`${prefix}close\` • \`${prefix}claim\`\n*Interactive hub: open tickets with 1 click, view active tickets, claim, close, deploy public panel, and setup category.*`
      },
      {
        name: '🛠️ Server Tools & Growth Hub (`/servertools` • `+tools`)',
        value: `\`${prefix}tools\` • \`${prefix}servertag [set|on|off|sync]\` • \`${prefix}counter setup\` • \`${prefix}inv top\` • \`${prefix}inviterole set @role\`\n*Interactive hub: Server Tag auto-role status & sync, voice member counters, invite logs, and inviter role guard.*`
      },
      {
        name: '🎮 Community Minigames Hub (`/games` • `+games`)',
        value: `\`${prefix}games\` • \`${prefix}rps [@user]\` • \`${prefix}trivia\` • \`${prefix}count [setup #chan]\` • \`${prefix}chain [setup #chan]\` • \`${prefix}bump [done|setup]\`\n*Interactive hub: Play RPS, timed Trivia questions, Counting game status, and Word Chain streak tracking.*`
      },
      {
        name: '✨ Emoji Stealer & Curated Packs (Mass & Selective Add)',
        value: `\`${prefix}addemj\` *(reply to add target emoji & all emojis below it)* • \`${prefix}steal <emojis...>\` • \`${prefix}massadd <emojis...>\` • \`${prefix}emoji packs\` • \`${prefix}emoji list\`\n*Reply to any emoji with \`${prefix}addemj\` to instantly add it and all emojis in messages below it directly to your server! Or use \`${prefix}steal\` for selective dropdown.*`
      },
      {
        name: '🧹 Chat Moderation & Purge (Reply to Purge)',
        value: `\`${prefix}purge\` *(reply to a message to purge everything after it)* • \`${prefix}purge include\` • \`${prefix}purge <amount> [@user|bots]\` • \`${prefix}clear\`\n*Quickly clean up chat: reply to any message with \`${prefix}purge\` and AURA deletes all messages sent after it!*`
      },
      {
        name: '⚙️ Modular Feature Controls (`/modules` • `+modules`)',
        value: `\`${prefix}modules\` • \`${prefix}modules on <feature|all>\` • \`${prefix}modules off <feature|all>\` • \`${prefix}modules toggle <feature>\`\n*Interactively enable or disable any bot feature selectively with dropdown menus & buttons!*`
      },
      {
        name: '⭐ Trusted Members (Full Immunity & Command Access)',
        value: `\`${prefix}trusted set @user\` • \`${prefix}trusted remove @user\` • \`${prefix}trusted list\` • \`${prefix}trusted clear\`\n*Set trusted members who are completely free from all disruptive actions (\`/bounce\`, \`/autodlt\`, \`/vc mute\`) AND can use all bot commands without being an admin or owner! (Server Owner & Bot Dev only)*`
      },
      {
        name: '📌 Sticky Messages & Image Threads',
        value: `\`${prefix}sticky <text>\` • \`${prefix}sticky list\` • \`${prefix}sticky remove\` • \`${prefix}thread setup <#chan>\``
      },
      {
        name: '⚡ Auto-Delete Within 1s (/autodlt)',
        value: `\`/autodlt target:@user duration:<time>\` • \`${prefix}autodlt @user <duration>\` • \`${prefix}autodlt stop @user\` • \`${prefix}autodlt list\`\n*Allows target user to send messages, but automatically deletes every message they send within a second for the specified duration (e.g. 30s, 5m, 1h)!*`
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
