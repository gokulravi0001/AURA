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
test('Features: Counting and Word Chain Services', () => {
  const countingService = require('../bot/modules/countingService');
  const wordChainService = require('../bot/modules/wordChainService');

  assert.strictEqual(typeof countingService.handleMessage, 'function');
  assert.strictEqual(typeof wordChainService.handleMessage, 'function');
  assert.strictEqual(typeof wordChainService.resetGame, 'function');
});

console.log(`\n\x1b[36mTest Summary: ${passed} Passed, ${failed} Failed\x1b[0m`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32m✔ All tests passed successfully!\x1b[0m\n');
}
