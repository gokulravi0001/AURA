const assert = require('assert');
const birthdayService = require('../bot/modules/birthdayService');
const levelingService = require('../bot/modules/levelingService');
const { MODULES, COLORS } = require('../shared/constants');

console.log('\x1b[36m>>> RUNNING AURA BOT UNIT & MODULE TESTS <<<\x1b[0m\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// 1. Constants Tests
test('Constants: Contains all required modules and colors', () => {
  assert.strictEqual(MODULES.LEVELING, 'leveling');
  assert.strictEqual(MODULES.JOIN_TO_CREATE, 'join_to_create');
  assert.strictEqual(MODULES.TICKETS, 'tickets');
  assert.strictEqual(MODULES.BIRTHDAYS, 'birthdays');
  assert.strictEqual(MODULES.MINIGAMES, 'minigames');
  assert.strictEqual(MODULES.STICKY_MESSAGES, 'sticky_messages');
  assert.strictEqual(MODULES.IMAGE_THREADS, 'image_threads');
  assert.strictEqual(MODULES.BUMP_REMINDER, 'bump_reminder');
  assert.ok(COLORS.PRIMARY);
});

// 2. Birthday Parser Tests
test('Birthday Parser: DD/MM/YYYY', () => {
  const parsed = birthdayService.parseDate('24/10/2000');
  assert.deepStrictEqual(parsed, { day: 24, month: 10, year: 2000 });
});

test('Birthday Parser: DD-MM-YYYY', () => {
  const parsed = birthdayService.parseDate('05-08-1998');
  assert.deepStrictEqual(parsed, { day: 5, month: 8, year: 1998 });
});

test('Birthday Parser: DD/MM (No Year provided)', () => {
  const parsed = birthdayService.parseDate('15/04');
  assert.deepStrictEqual(parsed, { day: 15, month: 4, year: null });
});

test('Birthday Parser: Rejects Invalid Dates (e.g. Month 13 or Day 32)', () => {
  assert.strictEqual(birthdayService.parseDate('32/01/2000'), null);
  assert.strictEqual(birthdayService.parseDate('10/13/2000'), null);
  assert.strictEqual(birthdayService.parseDate('not-a-date'), null);
});

// 3. Leveling Math Tests
test('Leveling Math: XP calculation progression', () => {
  const xpLvl0 = levelingService.getXpForLevel(0);
  const xpLvl1 = levelingService.getXpForLevel(1);
  const xpLvl2 = levelingService.getXpForLevel(2);

  assert.strictEqual(xpLvl0, 100);
  assert.strictEqual(xpLvl1, 155);
  assert.strictEqual(xpLvl2, 220);
  assert.ok(xpLvl2 > xpLvl1 && xpLvl1 > xpLvl0);
});

// 4. Mongoose Models Check
test('Models: Schemas compile without errors', () => {
  const Guild = require('../models/Guild');
  const UserXP = require('../models/UserXP');
  const Ticket = require('../models/Ticket');
  const StickyMessage = require('../models/StickyMessage');
  const Birthday = require('../models/Birthday');
  const TempVoice = require('../models/TempVoice');

  assert.ok(Guild);
  assert.ok(UserXP);
  assert.ok(Ticket);
  assert.ok(StickyMessage);
  assert.ok(Birthday);
  assert.ok(TempVoice);
});

// 5. Commands Check
test('Commands: General, Leveling, Voice, Tickets, Moderation, Birthday, Games, Bump exist', () => {
  const ping = require('../bot/commands/general/ping');
  const help = require('../bot/commands/general/help');
  const rank = require('../bot/commands/leveling/rank');
  const voice = require('../bot/commands/voice/voicecontrols');
  const tickets = require('../bot/commands/tickets/ticketpanel');
  const sticky = require('../bot/commands/moderation/sticky');
  const birthday = require('../bot/commands/birthday/birthday');
  const games = require('../bot/commands/games/games');
  const bump = require('../bot/commands/bump/bump');
  const invites = require('../bot/commands/utility/invites');
  const modulesCmd = require('../bot/commands/general/modules');
  const purge = require('../bot/commands/moderation/purge');
  const bounce = require('../bot/commands/voice/bounce');

  assert.ok(ping.data && ping.executePrefix);
  assert.ok(help.data && help.executePrefix);
  assert.ok(rank.data && rank.executePrefix);
  assert.ok(voice.data && voice.executePrefix);
  assert.ok(tickets.data && tickets.executePrefix);
  assert.ok(sticky.data && sticky.executePrefix);
  assert.ok(birthday.data && birthday.executePrefix);
  assert.ok(games.data && games.executePrefix);
  assert.ok(bump.data && bump.executePrefix);
  assert.ok(invites.data && invites.executePrefix);
  assert.ok(modulesCmd.data && modulesCmd.executePrefix);
  assert.ok(purge.data && purge.executePrefix);
  assert.ok(bounce.data && bounce.executePrefix);
});

// 6. Sticky & Birthday Channel Separation Check
test('Features: Sticky cache and Birthday Channel schema', () => {
  const stickyService = require('../bot/modules/stickyService');
  assert.strictEqual(typeof stickyService.loadCache, 'function');
  assert.strictEqual(typeof stickyService.updateCache, 'function');
  assert.strictEqual(typeof stickyService.handleMessage, 'function');

  const Guild = require('../models/Guild');
  const schema = Guild.schema.obj;
  assert.ok(schema.birthdays.setChannelId !== undefined);
  assert.ok(schema.birthdays.wishChannelId !== undefined);
});

// 7. Invite Tracker Check
test('Features: Invite Tracker model & service', () => {
  const Invite = require('../models/Invite');
  const MemberInvite = require('../models/MemberInvite');
  const inviteService = require('../bot/modules/inviteService');

  assert.ok(Invite);
  assert.ok(MemberInvite);
  assert.strictEqual(typeof inviteService.init, 'function');
  assert.strictEqual(typeof inviteService.handleMemberJoin, 'function');
  assert.strictEqual(typeof inviteService.handleMemberLeave, 'function');

  const testInv = new Invite({ guildId: '123', userId: '456', regular: 5, bonus: 2, left: 1, fake: 1 });
  assert.strictEqual(testInv.total, 5); // (5 + 2) - 1 - 1 = 5
});

// 8. Minigames Handlers & Reaction Check
test('Features: Counting and Word Chain Services', async () => {
  const countingService = require('../bot/modules/countingService');
  const wordChainService = require('../bot/modules/wordChainService');

  assert.strictEqual(typeof countingService.handleMessage, 'function');
  assert.strictEqual(typeof wordChainService.handleMessage, 'function');
  assert.strictEqual(typeof wordChainService.resetGame, 'function');

  // Verify duplicate word caution handling
  let reactedEmoji = null;
  let sentMessage = null;
  const mockMsg = {
    content: 'apple',
    author: { id: 'user_different', bot: false },
    guild: { id: 'guild_123' },
    react: async (emoji) => { reactedEmoji = emoji; },
    channel: {
      send: async (text) => { sentMessage = text; }
    }
  };

  const mockSettings = {
    wordChainGame: {
      lastWord: 'zebra',
      lastUserId: 'user_first',
      usedWords: ['apple', 'zebra'],
      currentStreak: 5,
      highScore: 10
    }
  };

  const handled = await wordChainService.handleMessage(mockMsg, mockSettings);
  assert.strictEqual(handled, true);
  assert.strictEqual(reactedEmoji, '⚠️');
  assert.ok(sentMessage && sentMessage.includes("already typed"));
  assert.ok(sentMessage && sentMessage.includes("hasn't been broken"));
  // Streak preserved
  assert.strictEqual(mockSettings.wordChainGame.currentStreak, 5);
});

// 9. Temp Voice Control Panel Embed & Button Check
test('Features: Temp Voice Manager & Interactive Control Panel', () => {
  const voiceManager = require('../bot/modules/voiceManager');
  assert.strictEqual(typeof voiceManager.buildControlPanel, 'function');
  assert.strictEqual(typeof voiceManager.sendControlPanel, 'function');
  assert.strictEqual(typeof voiceManager.handleButton, 'function');
  assert.strictEqual(typeof voiceManager.handleModal, 'function');

  const mockMember = {
    id: 'user_123',
    user: {
      username: 'TestUser',
      displayAvatarURL: () => 'https://example.com/avatar.png'
    }
  };

  const panel = voiceManager.buildControlPanel({ id: 'chan_123', name: 'Test Lounge' }, mockMember);
  assert.ok(panel.embeds && panel.embeds.length === 1);
  assert.ok(panel.components && panel.components.length === 2);
});

// 10. Modular Features Control Panel Check
test('Features: Modules Command & Panel Builder', () => {
  const modulesCmd = require('../bot/commands/general/modules');
  assert.strictEqual(typeof modulesCmd.buildModulesPanel, 'function');
  assert.ok(modulesCmd.MODULE_DEFINITIONS.length >= 10);
  assert.strictEqual(modulesCmd.MODULE_ALIASES['leveling'], 'leveling');
  assert.strictEqual(modulesCmd.MODULE_ALIASES['vc'], 'join_to_create');

  const panel = modulesCmd.buildModulesPanel({ modules: { leveling: false, tickets: true } }, { name: 'Test Server' });
  assert.ok(panel.embeds && panel.embeds.length === 1);
  assert.ok(panel.components && panel.components.length === 2);
});

// 11. Birthday Multi-Country Timezone Resolution
test('Features: Birthday Timezone Resolution & Local Time', () => {
  assert.strictEqual(birthdayService.resolveTimezone('India'), 'Asia/Kolkata');
  assert.strictEqual(birthdayService.resolveTimezone('IST'), 'Asia/Kolkata');
  assert.strictEqual(birthdayService.resolveTimezone('+5:30'), 'Asia/Kolkata');
  assert.strictEqual(birthdayService.resolveTimezone('USA'), 'America/New_York');
  assert.strictEqual(birthdayService.resolveTimezone('UK'), 'Europe/London');
  assert.strictEqual(birthdayService.resolveTimezone('Dubai'), 'Asia/Dubai');
  assert.strictEqual(birthdayService.resolveTimezone('Japan'), 'Asia/Tokyo');

  const local = birthdayService.getUserLocalTime('Asia/Kolkata');
  assert.ok(local.year >= 2026);
  assert.ok(local.month >= 1 && local.month <= 12);
  assert.ok(local.day >= 1 && local.day <= 31);
  assert.ok(local.hour >= 0 && local.hour <= 23);
  assert.ok(local.minute >= 0 && local.minute <= 59);
});

// 12. Voice Controls & Mass Actions (Move, DC, Mute, Unmute) Verification
test('Features: Voice Controls & Mass Actions (Move, DC, Mute, Unmute) Command', () => {
  const voice = require('../bot/commands/voice/voicecontrols');
  assert.ok(voice.aliases.includes('massmove'));
  assert.ok(voice.aliases.includes('movevc'));
  assert.ok(voice.aliases.includes('massdc'));
  assert.ok(voice.aliases.includes('massdisconnect'));
  assert.ok(voice.aliases.includes('vcdc'));
  assert.ok(voice.aliases.includes('massmute'));
  assert.ok(voice.aliases.includes('massunmute'));
  assert.ok(voice.aliases.includes('vcmute'));
  assert.ok(voice.aliases.includes('vcunmute'));
  assert.ok(voice.aliases.includes('bounce'));
  assert.ok(voice.aliases.includes('vcbounce'));
  assert.ok(voice.aliases.includes('orbit'));

  const json = voice.data.toJSON();
  assert.strictEqual(json.name, 'vc');
  const moveSub = json.options.find(opt => opt.name === 'move');
  assert.ok(moveSub, 'Subcommand "move" should exist');
  assert.strictEqual(moveSub.type, 1); // 1 = SUB_COMMAND

  const toOpt = moveSub.options.find(opt => opt.name === 'to');
  const fromOpt = moveSub.options.find(opt => opt.name === 'from');
  assert.ok(toOpt && toOpt.required === true);
  assert.ok(fromOpt && fromOpt.required !== true);

  const dcSub = json.options.find(opt => opt.name === 'disconnect');
  assert.ok(dcSub, 'Subcommand "disconnect" should exist');
  assert.strictEqual(dcSub.type, 1);

  const chanOpt = dcSub.options.find(opt => opt.name === 'channel');
  assert.ok(chanOpt && chanOpt.required !== true);

  const muteSub = json.options.find(opt => opt.name === 'mute');
  assert.ok(muteSub, 'Subcommand "mute" should exist');
  assert.strictEqual(muteSub.type, 1);
  const muteChanOpt = muteSub.options.find(opt => opt.name === 'channel');
  assert.ok(muteChanOpt && muteChanOpt.required !== true);

  const unmuteSub = json.options.find(opt => opt.name === 'unmute');
  assert.ok(unmuteSub, 'Subcommand "unmute" should exist');
  assert.strictEqual(unmuteSub.type, 1);
  const unmuteChanOpt = unmuteSub.options.find(opt => opt.name === 'channel');
  assert.ok(unmuteChanOpt && unmuteChanOpt.required !== true);

  const bounceSub = json.options.find(opt => opt.name === 'bounce');
  assert.ok(bounceSub, 'Subcommand "bounce" should exist');
  assert.strictEqual(bounceSub.type, 1);
  const targetOpt = bounceSub.options.find(opt => opt.name === 'target');
  assert.ok(targetOpt && targetOpt.required === true);
  const roundsOpt = bounceSub.options.find(opt => opt.name === 'rounds');
  assert.ok(roundsOpt && roundsOpt.min_value === 1 && roundsOpt.max_value === 100);

  // Top-level bounce command check
  const bounceCmd = require('../bot/commands/voice/bounce');
  const bounceJson = bounceCmd.data.toJSON();
  assert.strictEqual(bounceJson.name, 'bounce');
  const topRounds = bounceJson.options.find(o => o.name === 'rounds');
  assert.ok(topRounds && topRounds.min_value === 1 && topRounds.max_value === 100);
});

// 13. Emoji Manager & Selective / Mass Add Verification
test('Features: Emoji Manager & Selective / Mass Add System', () => {
  const emojiManager = require('../bot/modules/emojiManager');
  const emojiCmd = require('../bot/commands/utility/emoji');

  // Verify parser
  const sampleText = 'Look at this <:pepe_happy:102030405060708090> and <a:party_cat:908070605040302010> https://example.com/art.png';
  const parsed = emojiManager.parseEmojis(sampleText);
  assert.strictEqual(parsed.length, 3);
  assert.strictEqual(parsed[0].name, 'pepe_happy');
  assert.strictEqual(parsed[0].animated, false);
  assert.strictEqual(parsed[0].url, 'https://cdn.discordapp.com/emojis/102030405060708090.png');
  assert.strictEqual(parsed[1].name, 'party_cat');
  assert.strictEqual(parsed[1].animated, true);
  assert.strictEqual(parsed[1].url, 'https://cdn.discordapp.com/emojis/908070605040302010.gif');
  assert.strictEqual(parsed[2].name, 'art');

  // Verify packs
  assert.ok(emojiManager.EMOJI_PACKS.pepe);
  assert.ok(emojiManager.EMOJI_PACKS.anime);
  assert.ok(emojiManager.EMOJI_PACKS.gaming);
  assert.ok(emojiManager.EMOJI_PACKS.aesthetic);
  assert.ok(emojiManager.EMOJI_PACKS.badges);
  assert.ok(emojiManager.EMOJI_PACKS.pepe.emojis.length >= 5);

  // Verify session and selective panel
  const sessionId = emojiManager.createSession('user1', 'guild1', parsed, 'Test Emojis');
  const mockGuild = {
    premiumTier: 0,
    emojis: {
      cache: new Map()
    }
  };
  const panel = emojiManager.buildSelectivePanel(sessionId, mockGuild);
  assert.ok(panel.embeds && panel.embeds.length === 1);
  assert.ok(panel.components && panel.components.length === 2);

  // Verify command options and aliases
  assert.ok(emojiCmd.aliases.includes('steal'));
  assert.ok(emojiCmd.aliases.includes('massadd'));
  const json = emojiCmd.data.toJSON();
  assert.strictEqual(json.name, 'emoji');
  assert.ok(json.options.find(o => o.name === 'steal'));
  assert.ok(json.options.find(o => o.name === 'add'));
  assert.ok(json.options.find(o => o.name === 'packs'));
  assert.ok(json.options.find(o => o.name === 'list'));
});

// 14. Purge Command & Reply Purge Verification
test('Features: Purge Command & Reply-to-Purge Verification', () => {
  const purgeCmd = require('../bot/commands/moderation/purge');

  assert.ok(purgeCmd.aliases.includes('clear'));
  assert.ok(purgeCmd.aliases.includes('clean'));
  assert.ok(purgeCmd.aliases.includes('prune'));

  const json = purgeCmd.data.toJSON();
  assert.strictEqual(json.name, 'purge');

  const afterSub = json.options.find(o => o.name === 'after');
  assert.ok(afterSub, 'Subcommand "after" should exist');
  assert.strictEqual(afterSub.type, 1);
  const msgIdOpt = afterSub.options.find(o => o.name === 'message_id');
  assert.ok(msgIdOpt && msgIdOpt.required === true);

  const msgsSub = json.options.find(o => o.name === 'messages');
  assert.ok(msgsSub, 'Subcommand "messages" should exist');
  assert.strictEqual(msgsSub.type, 1);
  const amtOpt = msgsSub.options.find(o => o.name === 'amount');
  assert.ok(amtOpt && amtOpt.required === true);
});

console.log(`\n\x1b[36mTest Summary: ${passed} Passed, ${failed} Failed\x1b[0m`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32m✔ All tests passed successfully!\x1b[0m\n');
}
