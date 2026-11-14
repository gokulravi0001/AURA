const assert = require('assert');
const Guild = require('../models/Guild');
Guild.updateOne = async () => ({ acknowledged: true, modifiedCount: 1 });
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
  const countOpt = bounceSub.options.find(opt => opt.name === 'count');
  assert.ok(countOpt && countOpt.min_value === 1 && countOpt.max_value === 100);

  // Top-level bounce command check
  const bounceCmd = require('../bot/commands/voice/bounce');
  const bounceJson = bounceCmd.data.toJSON();
  assert.strictEqual(bounceJson.name, 'bounce');
  const topRounds = bounceJson.options.find(o => o.name === 'rounds');
  assert.ok(topRounds && topRounds.min_value === 1 && topRounds.max_value === 100);
  const topCount = bounceJson.options.find(o => o.name === 'count');
  assert.ok(topCount && topCount.min_value === 1 && topCount.max_value === 100);

  // Bounce Manager parsing tests
  const bounceManager = require('../bot/modules/bounceManager');
  assert.strictEqual(bounceManager.parseRounds(['10']), 10);
  assert.strictEqual(bounceManager.parseRounds(['100']), 100);
  assert.strictEqual(bounceManager.parseRounds(['count', '10']), 10);
  assert.strictEqual(bounceManager.parseRounds(['count:100']), 100);
  assert.strictEqual(bounceManager.parseRounds(['rounds=50']), 50);
  assert.strictEqual(bounceManager.parseRounds(['<@123456789012345678>', '10']), 10);
  assert.strictEqual(bounceManager.parseRounds(['<@123456789012345678>', 'count:100']), 100);
  assert.strictEqual(bounceManager.parseRounds(['<@123456789012345678>', '250']), 100); // capped at 100
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

// 15. Bot Developer Global Permission Bypass Verification
test('Features: Bot Developer Global Permission Bypass', () => {
  const { isBotOwner, isOwnerOrAdmin, hasPermissionOrOwner } = require('../shared/permissionHelper');

  // Verify known bot developers
  assert.strictEqual(isBotOwner('1487429529717706842'), true, 'redflash00 should be recognized as bot owner');
  assert.strictEqual(isBotOwner('1447912706232422443'), true, '.ahl_1 should be recognized as bot owner');
  assert.strictEqual(isBotOwner('999999999999999999'), false, 'Random user should not be bot owner');

  // Verify isOwnerOrAdmin bypasses across any guild even with empty member perms
  const mockGuild = { id: 'g_123', ownerId: 'server_owner_456', members: { cache: new Map() } };
  const mockBotOwnerUser = { id: '1487429529717706842' };
  const mockRandomUser = { id: 'random_user_999' };
  const mockServerOwnerUser = { id: 'server_owner_456' };

  assert.strictEqual(isOwnerOrAdmin(mockBotOwnerUser, mockGuild), true, 'Bot Owner must have access in any server');
  assert.strictEqual(isOwnerOrAdmin(mockServerOwnerUser, mockGuild), true, 'Server Owner must have access');
  assert.strictEqual(isOwnerOrAdmin(mockRandomUser, mockGuild), false, 'Regular member without perms must be rejected');

  // Verify hasPermissionOrOwner bypass
  assert.strictEqual(hasPermissionOrOwner(mockBotOwnerUser, 0x0000000000002000n), true, 'Bot Owner must bypass specific permissions');
  assert.strictEqual(hasPermissionOrOwner(mockRandomUser, 0x0000000000002000n), false, 'Regular user without permission must not bypass');
});

// 16. Whitelist Command & Permission Bypass Verification
test('Features: Whitelist Command & Permission Bypass', () => {
  const whitelistCmd = require('../bot/commands/general/whitelist');
  const whitelistService = require('../shared/whitelistService');
  const { isOwnerOrAdmin, hasPermissionOrOwner, canManageWhitelist } = require('../shared/permissionHelper');

  // Verify command metadata
  assert.strictEqual(whitelistCmd.name, 'whitelist');
  assert.ok(whitelistCmd.aliases.includes('wl'));
  const json = whitelistCmd.data.toJSON();
  assert.strictEqual(json.name, 'whitelist');
  assert.ok(json.options.find(o => o.name === 'add'));
  assert.ok(json.options.find(o => o.name === 'remove'));
  assert.ok(json.options.find(o => o.name === 'list'));
  assert.ok(json.options.find(o => o.name === 'clear'));

  // Verify canManageWhitelist: Only Server Owner and Bot Owner can manage
  const mockGuild = { id: 'guild_test_1', ownerId: 'owner_user_1', members: { cache: new Map() } };
  const botDevUser = { id: '1487429529717706842' };
  const serverOwnerUser = { id: 'owner_user_1' };
  const regularUser = { id: 'regular_user_888' };
  const whitelistedUser = { id: 'whitelisted_user_777' };

  assert.strictEqual(canManageWhitelist(botDevUser, mockGuild), true, 'Bot developer must manage whitelist');
  assert.strictEqual(canManageWhitelist(serverOwnerUser, mockGuild), true, 'Server owner must manage whitelist');
  assert.strictEqual(canManageWhitelist(regularUser, mockGuild), false, 'Regular member cannot manage whitelist');
  assert.strictEqual(canManageWhitelist(whitelistedUser, mockGuild), false, 'Whitelisted member cannot manage whitelist itself');

  // Verify isWhitelisted functionality with settings.whitelist
  const mockSettings = { whitelist: ['whitelisted_user_777'] };
  assert.strictEqual(whitelistService.isWhitelisted('whitelisted_user_777', 'guild_test_1', mockSettings), true);
  assert.strictEqual(whitelistService.isWhitelisted('regular_user_888', 'guild_test_1', mockSettings), false);

  // Verify isOwnerOrAdmin allows whitelisted user even with 0 administrator permissions
  assert.strictEqual(isOwnerOrAdmin(whitelistedUser, mockGuild, null, mockSettings), true, 'Whitelisted user must pass isOwnerOrAdmin');
  assert.strictEqual(isOwnerOrAdmin(regularUser, mockGuild, null, mockSettings), false, 'Non-whitelisted user without admin must fail');

  // Verify hasPermissionOrOwner allows whitelisted user
  assert.strictEqual(hasPermissionOrOwner(whitelistedUser, 0x0000000000002000n, null, mockSettings), true, 'Whitelisted user must pass hasPermissionOrOwner');
  assert.strictEqual(hasPermissionOrOwner(regularUser, 0x0000000000002000n, null, mockSettings), false, 'Non-whitelisted user must fail');
});

// 20. Immunity System Verification
test('Features: Immunity System & VC Command Protection', () => {
  const immunityCmd = require('../bot/commands/general/immunity');
  const immunityService = require('../shared/immunityService');

  // Verify command metadata
  assert.strictEqual(immunityCmd.name, 'immunity');
  assert.ok(immunityCmd.aliases.includes('imunity'));
  assert.ok(immunityCmd.aliases.includes('immune'));
  const json = immunityCmd.data.toJSON();
  assert.strictEqual(json.name, 'immunity');
  assert.ok(json.options.find(o => o.name === 'add'));
  assert.ok(json.options.find(o => o.name === 'remove'));
  assert.ok(json.options.find(o => o.name === 'role'));
  assert.ok(json.options.find(o => o.name === 'list'));
  assert.ok(json.options.find(o => o.name === 'clear'));

  // Verify User ID 1487429529717706842 has permanent absolute immunity
  assert.strictEqual(immunityService.isImmune('1487429529717706842'), true, 'User 1487429529717706842 must have permanent absolute immunity');
  assert.strictEqual(immunityService.isImmune('<@1487429529717706842>'), true, 'Mention string for 1487429529717706842 must be immune');
  assert.strictEqual(immunityService.isImmune('<@!1487429529717706842>'), true, 'Nickname mention string for 1487429529717706842 must be immune');
  assert.strictEqual(immunityService.isImmune({ id: '1487429529717706842' }), true, 'User object with 1487429529717706842 must be immune');
  assert.strictEqual(immunityService.isImmune({ user: { id: '1487429529717706842' } }), true, 'GuildMember object with 1487429529717706842 must be immune');
  assert.strictEqual(immunityService.isAbsoluteImmune('1487429529717706842'), true, 'isAbsoluteImmune must return true for 1487429529717706842');
  assert.strictEqual(immunityService.isAbsoluteImmune('<@1487429529717706842>'), true, 'isAbsoluteImmune must return true for mention string');

  // Verify that even in a guild owned by someone else, 1487429529717706842 remains completely immune
  const otherOwnerGuild = { id: 'other_guild_999', ownerId: 'hostile_owner_888', members: { cache: new Map() } };
  assert.strictEqual(immunityService.isImmune('1487429529717706842', otherOwnerGuild), true, 'Server Owner cannot bypass developer absolute immunity');
  assert.strictEqual(immunityService.isAbsoluteImmune('1487429529717706842'), true, '1487429529717706842 is absolutely immune across all guilds');

  // Verify other bot owners are immune
  assert.strictEqual(immunityService.isImmune('1447912706232422443'), true, 'Developer 1447912706232422443 must have immunity');

  // Verify guild owner is immune in their own guild
  const mockGuild = { id: 'guild_im_1', ownerId: 'guild_owner_999', members: { cache: new Map() } };
  assert.strictEqual(immunityService.isImmune('guild_owner_999', mockGuild), true, 'Guild owner must have immunity in their guild');

  // Verify regular user is not immune
  assert.strictEqual(immunityService.isImmune('random_user_555', mockGuild), false, 'Regular member must not be immune by default');

  // Verify server-configured immune user via settings
  const immuneSettings = { immunity: { users: ['immune_vip_123'], roles: ['immune_role_456'] } };
  assert.strictEqual(immunityService.isImmune('immune_vip_123', mockGuild, null, immuneSettings), true, 'User in settings.immunity.users must be immune');
  assert.strictEqual(immunityService.isImmune('random_user_555', mockGuild, null, immuneSettings), false, 'User not in settings must not be immune');

  // Verify role immunity
  const mockMemberWithRole = {
    id: 'role_member_777',
    roles: { cache: new Map([['immune_role_456', { id: 'immune_role_456' }]]) }
  };
  const mockMemberWithoutRole = {
    id: 'no_role_member_888',
    roles: { cache: new Map([['other_role_999', { id: 'other_role_999' }]]) }
  };
  assert.strictEqual(immunityService.isImmune(mockMemberWithRole, mockGuild, null, immuneSettings), true, 'Member with immune role must be immune');
  assert.strictEqual(immunityService.isImmune(mockMemberWithoutRole, mockGuild, null, immuneSettings), false, 'Member without immune role must not be immune');
});

// 21. Auto-Delete & Shadow-Mute Verification (/autodlt)
test('Features: Auto-Delete & Shadow-Mute System (/autodlt)', async () => {
  const autoDeleteService = require('../shared/autoDeleteService');
  const autodltCmd = require('../bot/commands/moderation/autodlt');

  // Verify command metadata
  assert.strictEqual(autodltCmd.name, 'autodlt');
  assert.ok(autodltCmd.aliases.includes('autodelete'));
  assert.ok(autodltCmd.aliases.includes('shadowmute'));
  assert.ok(autodltCmd.aliases.includes('shred'));
  const json = autodltCmd.data.toJSON();
  assert.strictEqual(json.name, 'autodlt');
  assert.ok(json.options.find(o => o.name === 'target'));
  assert.ok(json.options.find(o => o.name === 'duration'));
  assert.ok(json.options.find(o => o.name === 'channel'));

  // Verify parseDuration
  const p30s = autoDeleteService.parseDuration('30s');
  assert.strictEqual(p30s.ms, 30000);
  assert.strictEqual(p30s.stop, false);

  const p10m = autoDeleteService.parseDuration('10m');
  assert.strictEqual(p10m.ms, 600000);

  const pDefaultNum = autoDeleteService.parseDuration('15');
  assert.strictEqual(pDefaultNum.ms, 900000); // 15m default

  const p1h = autoDeleteService.parseDuration('2h');
  assert.strictEqual(p1h.ms, 7200000);

  const pStop = autoDeleteService.parseDuration('stop');
  assert.strictEqual(pStop.stop, true);

  const pOff = autoDeleteService.parseDuration('off');
  assert.strictEqual(pOff.stop, true);

  const pPerm = autoDeleteService.parseDuration('permanent');
  assert.strictEqual(pPerm.ms, null);
  assert.strictEqual(pPerm.stop, false);

  // Verify formatDuration
  assert.strictEqual(autoDeleteService.formatDuration(600000), '10m');

  // Verify immune member CANNOT be targeted by user auto-delete
  const immuneResult = await autoDeleteService.setUserRule('guild_test_1', '1487429529717706842', 60000);
  assert.strictEqual(immuneResult.success, false, 'Immune developer 1487429529717706842 must be rejected from user auto-delete');
  assert.ok(immuneResult.error.includes('Immunity Protected'));

  // Verify regular member can be set for auto-delete
  const normalUserResult = await autoDeleteService.setUserRule('guild_test_1', 'spammer_12345', 60000);
  assert.strictEqual(normalUserResult.success, true);

  // Verify handleMessage marks message for deletion within a second (returns true)
  const mockSpammerMsg = {
    guild: { id: 'guild_test_1' },
    channel: { id: 'channel_chat_1' },
    author: { id: 'spammer_12345', bot: false },
    content: 'Spam message!',
    delete: async () => {}
  };
  const wasSpamHandled = await autoDeleteService.handleMessage(mockSpammerMsg);
  assert.strictEqual(wasSpamHandled, true);

  // Verify handleMessage NEVER deletes message from immune developer even in auto-deleted channel
  await autoDeleteService.setChannelRule('guild_test_1', 'channel_chat_1', 60000);
  const mockDevMsg = {
    guild: { id: 'guild_test_1' },
    channel: { id: 'channel_chat_1' },
    author: { id: '1487429529717706842', bot: false },
    content: 'Developer announcement in silenced channel',
    delete: async () => {}
  };
  const wasDevDeleted = await autoDeleteService.handleMessage(mockDevMsg);
  assert.strictEqual(wasDevDeleted, false, 'Developer messages must never be auto-deleted');

  // Clean up test rules
  await autoDeleteService.clearAll('guild_test_1');
});

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function createCollectionMap(entries = []) {
  const map = new Map(entries);
  map.filter = (predicate) => {
    const filtered = new Map();
    for (const [k, v] of map.entries()) {
      if (predicate(v, k, map)) filtered.set(k, v);
    }
    filtered.size;
    return createCollectionMap(Array.from(filtered.entries()));
  };
  return map;
}

function createServerTagTestContext(options = {}) {
  const guildId = options.guildId || 'guild_aura_1';
  const botId = options.botId || 'bot_aura_1';
  const tagRoleId = options.tagRoleId || 'role_aura_member';
  const secondRoleId = options.secondRoleId || 'role_aura_vip';
  const unrelatedRoleId = options.unrelatedRoleId || 'role_booster';
  const managedRoleId = options.managedRoleId || 'role_managed_bot';
  const highRoleId = options.highRoleId || 'role_owner';

  const apiCalls = { added: [], removed: [] };

  const rolesCache = createCollectionMap([
    [guildId, { id: guildId, name: '@everyone', position: 0, managed: false }],
    [tagRoleId, { id: tagRoleId, name: 'AURA Member', position: 5, managed: false }],
    [secondRoleId, { id: secondRoleId, name: 'AURA VIP', position: 6, managed: false }],
    [unrelatedRoleId, { id: unrelatedRoleId, name: 'Server Booster', position: 4, managed: false }],
    [managedRoleId, { id: managedRoleId, name: 'Bot Integration', position: 3, managed: true }],
    [highRoleId, { id: highRoleId, name: 'Server Owner', position: 25, managed: false }]
  ]);

  let hasManageRoles = options.hasManageRoles !== undefined ? options.hasManageRoles : true;
  let botPosition = options.botPosition !== undefined ? options.botPosition : 15;

  const botMember = {
    id: botId,
    permissions: {
      has: (flag) => {
        const { PermissionsBitField } = require('discord.js');
        if (flag === PermissionsBitField.Flags.ManageRoles) return hasManageRoles;
        return true;
      }
    },
    roles: {
      highest: { position: botPosition, name: 'AURA Bot' }
    }
  };

  function makeMember({ id, tag = null, identityGuildId = null, identityEnabled = false, verified = true, initialRoles = [], isBot = false }) {
    const roleSet = createCollectionMap(initialRoles.map(rid => [rid, rolesCache.get(rid) || { id: rid, name: rid }]));
    const memberObj = {
      id,
      _primaryGuildVerified: verified,
      guild: null,
      user: {
        id,
        bot: isBot,
        username: `user_${id}`,
        primaryGuild: identityGuildId !== null
          ? { identityGuildId, identityEnabled, tag, badge: identityGuildId ? 'badge_hash_1' : null }
          : null
      },
      roles: {
        cache: roleSet,
        add: async (role) => {
          const rId = typeof role === 'string' ? role : role.id;
          apiCalls.added.push({ memberId: id, roleId: rId });
          roleSet.set(rId, rolesCache.get(rId) || { id: rId, name: rId });
        },
        remove: async (role) => {
          const rId = typeof role === 'string' ? role : role.id;
          apiCalls.removed.push({ memberId: id, roleId: rId });
          roleSet.delete(rId);
        }
      }
    };
    return memberObj;
  }

  const membersCache = createCollectionMap();
  const guild = {
    id: guildId,
    name: 'AURA Community',
    features: options.features || ['GUILD_TAGS'],
    roles: { cache: rolesCache },
    members: {
      me: botMember,
      cache: membersCache,
      fetch: async () => membersCache,
      fetchMe: async () => botMember
    }
  };

  const client = {
    user: { id: botId },
    guilds: { cache: createCollectionMap([[guildId, guild]]) },
    users: { cache: createCollectionMap() },
    rest: options.rest || null,
    io: null
  };
  guild.client = client;

  const settings = {
    guildId,
    modules: { server_tag_role: true },
    serverTagRole: {
      enabled: true,
      roleId: tagRoleId,
      includeBots: false,
      serverTagId: guildId,
      serverTagName: null,
      activeMemberCount: 0,
      lastSyncStatus: 'never'
    }
  };

  function addMemberToGuild(cfg) {
    const m = makeMember(cfg);
    m.guild = guild;
    membersCache.set(m.id, m);
    client.users.cache.set(m.id, m.user);
    return m;
  }

  return {
    guild,
    client,
    settings,
    apiCalls,
    rolesCache,
    membersCache,
    tagRoleId,
    secondRoleId,
    unrelatedRoleId,
    managedRoleId,
    highRoleId,
    addMemberToGuild,
    setHasManageRoles: (val) => { hasManageRoles = val; }
  };
}

(async () => {
  const serverTagService = require('../bot/modules/serverTagService');
  const guildService = require('../shared/guildService');
  const userUpdateEvent = require('../bot/events/client/userUpdate');
  const guildMemberRemoveEvent = require('../bot/events/guild/guildMemberRemove');
  const rawEvent = require('../bot/events/client/raw');

  const originalGetSettings = guildService.getSettings;
  const originalUpdateSettings = guildService.updateSettings;

  // Scenario 1, 2 & 3: Adopt AURA tag, remove tag, or switch to another server's tag
  await asyncTest('ServerTag Scen 1-3: Adopt AURA tag -> add role, remove/switch tag -> remove ONLY tag role', async () => {
    serverTagService._clearVerificationCache();
    const ctx = createServerTagTestContext();
    guildService.getSettings = async () => ctx.settings;
    guildService.updateSettings = async (gId, data) => ctx.settings;

    const member = ctx.addMemberToGuild({
      id: 'mem_1',
      identityGuildId: null,
      verified: true,
      initialRoles: [ctx.unrelatedRoleId]
    });

    // Simulate userUpdate event when member adopts AURA tag
    const oldUser = { id: 'mem_1', partial: false, primaryGuild: null };
    member.user.primaryGuild = {
      identityGuildId: ctx.guild.id,
      identityEnabled: true,
      tag: 'AURA',
      badge: 'badge_aura'
    };

    await userUpdateEvent.execute(oldUser, member.user, ctx.client);
    assert.strictEqual(member.roles.cache.has(ctx.tagRoleId), true, 'AURA Member role should be added on tag adoption');
    assert.strictEqual(member.roles.cache.has(ctx.unrelatedRoleId), true, 'Unrelated role must remain untouched');

    // Simulate Scenario 3: member switches to another server's tag
    const prevUserSnap = {
      id: 'mem_1',
      partial: false,
      primaryGuild: { ...member.user.primaryGuild }
    };
    member.user.primaryGuild = {
      identityGuildId: 'other_guild_999',
      identityEnabled: true,
      tag: 'OTHR',
      badge: 'badge_other'
    };

    await userUpdateEvent.execute(prevUserSnap, member.user, ctx.client);
    assert.strictEqual(member.roles.cache.has(ctx.tagRoleId), false, 'AURA role must be removed when switching to another server tag');
    assert.strictEqual(member.roles.cache.has(ctx.unrelatedRoleId), true, 'Unrelated role must still be untouched');

    // Re-adopt via raw packet tracking (camelCase & snake_case) and then remove tag completely (null)
    member.user.primaryGuild = { identityGuildId: ctx.guild.id, identityEnabled: true, tag: 'AURA', badge: 'b1' };
    await serverTagService.syncMember(member, ctx.settings, ctx.client, { source: 'test' });
    assert.strictEqual(member.roles.cache.has(ctx.tagRoleId), true);

    // Simulate Scenario 2: member disables/removes tag (`primary_guild: null` verified via raw USER_UPDATE)
    await rawEvent.execute({
      t: 'USER_UPDATE',
      d: { id: 'mem_1', primary_guild: null }
    }, ctx.client);
    const snap2 = {
      id: 'mem_1',
      partial: false,
      primaryGuild: { identityGuildId: ctx.guild.id, identityEnabled: true, tag: 'AURA', badge: 'b1' }
    };
    member.user.primaryGuild = null;
    await userUpdateEvent.execute(snap2, member.user, ctx.client);
    assert.strictEqual(member.roles.cache.has(ctx.tagRoleId), false, 'AURA role must be removed when tag is removed');
    assert.strictEqual(member.roles.cache.has(ctx.unrelatedRoleId), true, 'Unrelated role must remain intact');
  });

  // Scenario 4 & 5: Member leaves server & Guild Schema persistence across restarts
  await asyncTest('ServerTag Scen 4-5: Member leave handled safely & Guild schema persists config', async () => {
    const ctx = createServerTagTestContext();
    ctx.settings.modules.invite_tracker = false; // isolate from MongoDB MemberInvite query in unit test
    let persistedCount = null;
    const origUpdateOne = Guild.updateOne;
    guildService.getSettings = async () => ctx.settings;
    Guild.updateOne = async (query, update) => {
      if (update?.$set?.['serverTagRole.activeMemberCount'] !== undefined) {
        persistedCount = update.$set['serverTagRole.activeMemberCount'];
      }
      return { acknowledged: true, modifiedCount: 1 };
    };

    const leavingMember = ctx.addMemberToGuild({
      id: 'mem_leave',
      identityGuildId: ctx.guild.id,
      identityEnabled: true,
      tag: 'AURA',
      initialRoles: [ctx.tagRoleId]
    });
    const remainingMember = ctx.addMemberToGuild({
      id: 'mem_stay',
      identityGuildId: ctx.guild.id,
      identityEnabled: true,
      tag: 'AURA',
      initialRoles: [ctx.tagRoleId]
    });

    // Simulate member leaving (handled cleanly whether already removed from cache or not)
    ctx.membersCache.delete(leavingMember.id);
    await guildMemberRemoveEvent.execute(leavingMember, ctx.client);
    Guild.updateOne = origUpdateOne;
    assert.strictEqual(persistedCount, 1, 'Remaining active member count should exclude departed member safely');
    assert.strictEqual(remainingMember.roles.cache.has(ctx.tagRoleId), true);

    // Scenario 5: Database schema defaults & persistence on Guild model
    const guildDoc = new Guild({
      guildId: 'restart_guild_1',
      serverTagRole: {
        enabled: true,
        roleId: 'role_999',
        serverTagId: 'restart_guild_1',
        detectedTag: 'AURA',
        includeBots: false,
        activeMemberCount: 1
      }
    });
    assert.strictEqual(guildDoc.modules.server_tag_role, true);
    assert.strictEqual(guildDoc.serverTagRole.enabled, true);
    assert.strictEqual(guildDoc.serverTagRole.roleId, 'role_999');
    assert.strictEqual(guildDoc.serverTagRole.detectedTag, 'AURA');
    assert.strictEqual(guildDoc.serverTagRole.includeBots, false);
    assert.strictEqual(guildDoc.serverTagRole.activeMemberCount, 1);
    assert.strictEqual(guildDoc.serverTagRole.lastSyncStatus, 'idle');
  });

  // Scenario 6 & 9: Temporary disconnect reconciliation + Unverified data safety + Bot exclusion
  await asyncTest('ServerTag Scen 6 & 9: Sync restores missed events, respects rate/no-ops, never removes unverified roles', async () => {
    serverTagService._clearVerificationCache();
    const ctx = createServerTagTestContext();
    guildService.updateSettings = async () => ctx.settings;

    // 1) Adopter missed event during disconnect (no role yet -> should receive role)
    const missedAdopt = ctx.addMemberToGuild({
      id: 'mem_adopt',
      identityGuildId: ctx.guild.id,
      identityEnabled: true,
      tag: 'AURA',
      verified: true,
      initialRoles: []
    });
    // 2) Remover missed event during disconnect (verified no tag, still has role -> should lose ONLY tag role)
    const missedRemove = ctx.addMemberToGuild({
      id: 'mem_remove',
      identityGuildId: null,
      verified: true,
      initialRoles: [ctx.tagRoleId, ctx.unrelatedRoleId]
    });
    // 3) Unverified member whose primary_guild data is unavailable (verified: false, REST unavailable) -> MUST KEEP role!
    const unverifiedMember = ctx.addMemberToGuild({
      id: 'mem_unverified',
      identityGuildId: null,
      verified: false,
      initialRoles: [ctx.tagRoleId]
    });
    // 4) Already-correct member -> must NOT trigger redundant Discord API calls
    const alreadySynced = ctx.addMemberToGuild({
      id: 'mem_ok',
      identityGuildId: ctx.guild.id,
      identityEnabled: true,
      tag: 'AURA',
      verified: true,
      initialRoles: [ctx.tagRoleId]
    });
    // 5) Bot account wearing tag when includeBots is false -> excluded from auto-role
    const botMember = ctx.addMemberToGuild({
      id: 'bot_1',
      isBot: true,
      identityGuildId: ctx.guild.id,
      identityEnabled: true,
      tag: 'AURA',
      verified: true,
      initialRoles: []
    });

    const syncRes = await serverTagService.syncGuild(ctx.guild, ctx.settings, ctx.client, { source: 'reconnect', force: true });
    assert.strictEqual(syncRes.success, true);
    assert.strictEqual(missedAdopt.roles.cache.has(ctx.tagRoleId), true, 'Reconnect sync must grant missed role');
    assert.strictEqual(missedRemove.roles.cache.has(ctx.tagRoleId), false, 'Reconnect sync must revoke tag role for verified non-wearer');
    assert.strictEqual(missedRemove.roles.cache.has(ctx.unrelatedRoleId), true, 'Unrelated role must never be removed');
    assert.strictEqual(unverifiedMember.roles.cache.has(ctx.tagRoleId), true, 'CRITICAL: Unverified tag status must NEVER revoke existing role');
    assert.strictEqual(alreadySynced.roles.cache.has(ctx.tagRoleId), true);
    assert.strictEqual(botMember.roles.cache.has(ctx.tagRoleId), false, 'Bots must be excluded unless explicitly configured');
    assert.strictEqual(ctx.apiCalls.added.length, 1, 'Only 1 role add API call should be made (skip unchanged)');
    assert.strictEqual(ctx.apiCalls.removed.length, 1, 'Only 1 role remove API call should be made (skip unverified)');
    assert.strictEqual(syncRes.stats.skippedUnverified, 1);
  });

  // Scenario 7 & 8: Role config change, role hierarchy/managed checks, and missing Manage Roles permission
  await asyncTest('ServerTag Scen 7-8: Admin role changes apply cleanly & permission/hierarchy errors are caught', async () => {
    const ctx = createServerTagTestContext();
    guildService.updateSettings = async () => ctx.settings;

    const tagHolder = ctx.addMemberToGuild({
      id: 'mem_holder',
      identityGuildId: ctx.guild.id,
      identityEnabled: true,
      tag: 'AURA',
      verified: true,
      initialRoles: [ctx.tagRoleId]
    });

    // Admin validates managed role & high role -> rejected clearly
    const managedCheck = await serverTagService.validateRoleConfiguration(ctx.guild, ctx.managedRoleId);
    assert.strictEqual(managedCheck.valid, false);
    assert.strictEqual(managedCheck.code, 'MANAGED_ROLE');

    const highCheck = await serverTagService.validateRoleConfiguration(ctx.guild, ctx.highRoleId);
    assert.strictEqual(highCheck.valid, false);
    assert.strictEqual(highCheck.code, 'ROLE_HIERARCHY');

    // Admin changes configured role to secondRoleId -> new role is applied cleanly
    ctx.settings.serverTagRole.roleId = ctx.secondRoleId;
    const syncRes = await serverTagService.syncGuild(ctx.guild, ctx.settings, ctx.client, { source: 'dashboardSave', force: true });
    assert.strictEqual(syncRes.success, true);
    assert.strictEqual(tagHolder.roles.cache.has(ctx.secondRoleId), true, 'Newly configured role must be assigned immediately');

    // Scenario 8: Bot loses Manage Roles permission -> clear error, no crash
    ctx.setHasManageRoles(false);
    const permRes = await serverTagService.syncGuild(ctx.guild, ctx.settings, ctx.client, { source: 'manual', force: true });
    assert.strictEqual(permRes.success, false);
    assert.strictEqual(permRes.code, 'MISSING_MANAGE_ROLES');
    assert.ok(permRes.error && permRes.error.includes('Manage Roles'));
  });

  // Extra Check: Modules registry & /servertag command (set, on, off, status, non-admin check)
  await asyncTest('ServerTag Integration: Constants, Modules & /servertag command (set/on/off/status)', async () => {
    assert.strictEqual(MODULES.SERVER_TAG_ROLE, 'server_tag_role');
    const modulesCmd = require('../bot/commands/general/modules');
    assert.ok(modulesCmd.MODULE_DEFINITIONS.some(m => m.key === 'server_tag_role'));
    assert.strictEqual(modulesCmd.MODULE_ALIASES['servertag'], 'server_tag_role');

    const serverTagCmd = require('../bot/commands/moderation/servertag');
    assert.strictEqual(serverTagCmd.data.name, 'servertag');

    const ctx = createServerTagTestContext();
    ctx.settings.serverTagRole.enabled = false;
    ctx.settings.serverTagRole.roleId = null;
    ctx.guild.ownerId = 'owner_1';
    ctx.addMemberToGuild({
      id: 'mem_tag',
      identityGuildId: ctx.guild.id,
      identityEnabled: true,
      tag: 'AURA',
      verified: true,
      initialRoles: []
    });

    guildService.getSettings = async () => ctx.settings;
    guildService.updateSettings = async (gId, data) => {
      if (data['modules.server_tag_role'] !== undefined) ctx.settings.modules.server_tag_role = data['modules.server_tag_role'];
      if (data['serverTagRole.enabled'] !== undefined) ctx.settings.serverTagRole.enabled = data['serverTagRole.enabled'];
      if (data['serverTagRole.roleId'] !== undefined) ctx.settings.serverTagRole.roleId = data['serverTagRole.roleId'];
      if (data['serverTagRole.includeBots'] !== undefined) ctx.settings.serverTagRole.includeBots = data['serverTagRole.includeBots'];
      return ctx.settings;
    };

    const runSlash = async (sub, opts = {}, isAdmin = true) => {
      let reply = null;
      const interaction = {
        guild: ctx.guild,
        member: {
          id: isAdmin ? 'owner_1' : 'regular_99',
          permissions: { has: () => isAdmin }
        },
        options: {
          getSubcommand: () => sub,
          getRole: (k) => (k === 'role' ? opts.role || null : null),
          getBoolean: (k) => (k === 'include_bots' ? opts.includeBots ?? null : null)
        },
        deferReply: async () => {},
        editReply: async (p) => { reply = p; },
        reply: async (p) => { reply = p; }
      };
      await serverTagCmd.execute(interaction, ctx.client, ctx.settings);
      return reply;
    };

    // Non-admin blocked
    const denied = await runSlash('off', {}, false);
    assert.ok(denied.content && denied.content.includes('Administrator'));

    // Set role -> enables & syncs immediately
    const setRes = await runSlash('set', { role: { id: ctx.tagRoleId, name: 'AURA Member' } }, true);
    assert.strictEqual(ctx.settings.serverTagRole.enabled, true);
    assert.strictEqual(ctx.settings.serverTagRole.roleId, ctx.tagRoleId);
    assert.ok(setRes.embeds && setRes.embeds.length === 1);

    // Off -> disables while keeping saved role
    const offRes = await runSlash('off', {}, true);
    assert.strictEqual(ctx.settings.serverTagRole.enabled, false);
    assert.strictEqual(ctx.settings.serverTagRole.roleId, ctx.tagRoleId);
    assert.ok(offRes.embeds && offRes.embeds[0].data.title.includes('Turned OFF'));

    // On -> re-enables with saved role
    const onRes = await runSlash('on', {}, true);
    assert.strictEqual(ctx.settings.serverTagRole.enabled, true);
    assert.ok(onRes.embeds && onRes.embeds[0].data.description.includes('ON'));
  });

  // Pre-Application Invite Logging & Screening Tests
  await asyncTest('InviteTracker: Logs who invited who before accepting server application/screening', async () => {
    const inviteService = require('../bot/modules/inviteService');
    const MemberInvite = require('../models/MemberInvite');
    const Invite = require('../models/Invite');
    const guildMemberUpdateEvent = require('../bot/events/guild/guildMemberUpdate');

    let sentChannelMessages = [];
    const mockChannel = {
      id: 'chan_inv_logs',
      isTextBased: () => true,
      send: async (payload) => {
        sentChannelMessages.push(payload);
        return payload;
      }
    };

    const mockGuild = {
      id: 'guild_inv_test',
      name: 'Invite Test Community',
      memberCount: 50,
      channels: {
        cache: new Map([['chan_inv_logs', mockChannel]])
      },
      invites: {
        fetch: async () => new Map([
          ['code_aura', { code: 'code_aura', uses: 5, inviter: { id: 'inviter_99', tag: 'Inviter#0001', username: 'Inviter' } }]
        ])
      }
    };

    const mockSettings = {
      guildId: 'guild_inv_test',
      modules: { invite_tracker: true },
      inviteTracker: {
        enabled: true,
        channelId: 'chan_inv_logs',
        logPreScreening: true,
        applicationChannelId: null
      }
    };

    // Prime the invite cache
    await inviteService.cacheGuildInvites(mockGuild);

    // Update invite uses to simulate someone joining with code_aura
    mockGuild.invites.fetch = async () => new Map([
      ['code_aura', { code: 'code_aura', uses: 6, inviter: { id: 'inviter_99', tag: 'Inviter#0001', username: 'Inviter' } }]
    ]);

    // 1. Simulate member joining who has NOT yet accepted server rules/application (member.pending === true)
    const pendingApplicant = {
      id: 'applicant_1',
      pending: true,
      guild: mockGuild,
      user: {
        id: 'applicant_1',
        tag: 'Applicant#1234',
        bot: false,
        createdTimestamp: Date.now() - (10 * 24 * 60 * 60 * 1000), // 10 days old (not fake)
        displayAvatarURL: () => 'https://example.com/avatar.png'
      }
    };

    let savedMemberInvite = null;
    const origFindOneAndUpdate = MemberInvite.findOneAndUpdate;
    MemberInvite.findOneAndUpdate = async (query, update, opts) => {
      savedMemberInvite = { ...(savedMemberInvite || {}), ...query, ...update };
      return savedMemberInvite;
    };
    const origFindOne = MemberInvite.findOne;
    MemberInvite.findOne = async () => savedMemberInvite;
    const origInviteFindOne = Invite.findOne;
    const mockInviterRecord = {
      guildId: 'guild_inv_test',
      userId: 'inviter_99',
      regular: 5,
      bonus: 0,
      fake: 0,
      left: 0,
      get total() { return this.regular + this.bonus - this.left; },
      save: async () => {}
    };
    Invite.findOne = async () => mockInviterRecord;

    await inviteService.handleMemberJoin(pendingApplicant, mockSettings, {});

    // Assert: Inviter was logged immediately, MemberInvite has pending: true
    assert.strictEqual(savedMemberInvite.inviterId, 'inviter_99');
    assert.strictEqual(savedMemberInvite.code, 'code_aura');
    assert.strictEqual(savedMemberInvite.pending, true, 'MemberInvite must record pending: true before screening');
    assert.ok(sentChannelMessages.length >= 1);
    const preLogEmbed = sentChannelMessages[0].embeds[0];
    assert.ok(preLogEmbed.data.title.includes('Application / Screening Pending'));
    assert.ok(preLogEmbed.data.description.includes('Invited by:'));
    assert.ok(preLogEmbed.data.description.includes('inviter_99'));

    // 2. Simulate applicant accepting the server application / rules (oldMember.pending: true -> newMember.pending: false)
    sentChannelMessages = [];
    const oldMember = { ...pendingApplicant, pending: true };
    const acceptedMember = { ...pendingApplicant, pending: false };

    guildService.getSettings = async () => mockSettings;
    await guildMemberUpdateEvent.execute(oldMember, acceptedMember, {});

    // Assert: Accepted notification logged, MemberInvite.pending updated to false
    assert.strictEqual(savedMemberInvite.pending, false, 'MemberInvite must update pending to false upon application acceptance');
    assert.ok(sentChannelMessages.length >= 1);
    const acceptedEmbed = sentChannelMessages[0].embeds[0];
    assert.ok(acceptedEmbed.data.title.includes('Application Accepted'));
    assert.ok(acceptedEmbed.data.description.includes('inviter_99'));

    // Restore stubs
    MemberInvite.findOneAndUpdate = origFindOneAndUpdate;
    MemberInvite.findOne = origFindOne;
    Invite.findOne = origInviteFindOne;
  });

  guildService.getSettings = originalGetSettings;
  guildService.updateSettings = originalUpdateSettings;

  console.log(`\n\x1b[36mTest Summary: ${passed} Passed, ${failed} Failed\x1b[0m`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\x1b[32m✔ All tests passed successfully!\x1b[0m\n');
    process.exit(0);
  }
})();
