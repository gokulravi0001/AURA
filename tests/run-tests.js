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
test('Commands: 12 Category Hubs and Prefix shortcuts exist and operate cleanly', () => {
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
  const modCmd = require('../bot/commands/moderation/mod');
  const systemCmd = require('../bot/commands/general/system');
  const toolsCmd = require('../bot/commands/general/servertools');

  // Category Hubs have slash command data and executePrefix
  assert.ok(help.data && help.executePrefix);
  assert.ok(voice.data && voice.executePrefix);
  assert.ok(tickets.data && tickets.executePrefix);
  assert.ok(birthday.data && birthday.executePrefix);
  assert.ok(games.data && games.executePrefix);
  assert.ok(modulesCmd.data && modulesCmd.executePrefix);
  assert.ok(modCmd.data && modCmd.executePrefix);
  assert.ok(systemCmd.data && systemCmd.executePrefix);
  assert.ok(toolsCmd.data && toolsCmd.executePrefix);

  // Sub-commands retain prefix execution and fast shortcut aliases
  assert.ok(ping.executePrefix && ping.name === 'ping');
  assert.ok(rank.executePrefix && rank.name === 'rank');
  assert.ok(sticky.executePrefix && sticky.name === 'sticky');
  assert.ok(bump.executePrefix && bump.name === 'bump');
  assert.ok(invites.executePrefix && invites.name === 'invites');
  assert.ok(purge.executePrefix && purge.name === 'purge');
  assert.ok(bounce.executePrefix && bounce.name === 'bounce');
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

  // Top-level bounce command check (Prefix shortcut & VC hub integration)
  const bounceCmd = require('../bot/commands/voice/bounce');
  assert.strictEqual(bounceCmd.name, 'bounce');
  assert.ok(typeof bounceCmd.executePrefix === 'function');
  assert.ok(bounceCmd.aliases.includes('vcbounce'));

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

  assert.strictEqual(purgeCmd.name, 'purge');
  assert.ok(typeof purgeCmd.executePrefix === 'function');
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

// 16. Trusted Member System Verification (/trusted)
test('Features: Trusted Member System & Permission Bypass (/trusted)', () => {
  const trustedCmd = require('../bot/commands/general/trusted');
  const trustedService = require('../shared/trustedService');
  const { isOwnerOrAdmin, hasPermissionOrOwner, canManageTrusted } = require('../shared/permissionHelper');

  // Verify command metadata
  assert.strictEqual(trustedCmd.name, 'trusted');
  assert.ok(trustedCmd.aliases.includes('trust'));
  assert.ok(trustedCmd.aliases.includes('trustedmember'));
  assert.ok(trustedCmd.aliases.includes('trustedmembers'));
  const json = trustedCmd.data.toJSON();
  assert.strictEqual(json.name, 'trusted');
  assert.ok(json.options.find(o => o.name === 'set'));
  assert.ok(json.options.find(o => o.name === 'remove'));
  assert.ok(json.options.find(o => o.name === 'list'));
  assert.ok(json.options.find(o => o.name === 'clear'));

  // Verify canManageTrusted: Only Server Owner and Bot Owner can manage
  const mockGuild = { id: 'guild_test_1', ownerId: 'owner_user_1', members: { cache: new Map() } };
  const botDevUser = { id: '1487429529717706842' };
  const serverOwnerUser = { id: 'owner_user_1' };
  const regularUser = { id: 'regular_user_888' };
  const trustedUser = { id: 'trusted_user_777' };

  assert.strictEqual(canManageTrusted(botDevUser, mockGuild), true, 'Bot developer must manage trusted members');
  assert.strictEqual(canManageTrusted(serverOwnerUser, mockGuild), true, 'Server owner must manage trusted members');
  assert.strictEqual(canManageTrusted(regularUser, mockGuild), false, 'Regular member cannot manage trusted members');
  assert.strictEqual(canManageTrusted(trustedUser, mockGuild), false, 'Trusted member cannot manage trusted list itself');

  // Verify isTrusted functionality with settings.trustedMembers
  const mockSettings = { trustedMembers: ['trusted_user_777'] };
  assert.strictEqual(trustedService.isTrusted('trusted_user_777', 'guild_test_1', mockSettings), true);
  assert.strictEqual(trustedService.isTrusted('regular_user_888', 'guild_test_1', mockSettings), false);

  // Verify isOwnerOrAdmin allows trusted user even with 0 administrator permissions
  assert.strictEqual(isOwnerOrAdmin(trustedUser, mockGuild, null, mockSettings), true, 'Trusted user must pass isOwnerOrAdmin');
  assert.strictEqual(isOwnerOrAdmin(regularUser, mockGuild, null, mockSettings), false, 'Non-trusted user without admin must fail');

  // Verify hasPermissionOrOwner allows trusted user
  assert.strictEqual(hasPermissionOrOwner(trustedUser, 0x0000000000002000n, null, mockSettings), true, 'Trusted user must pass hasPermissionOrOwner');
  assert.strictEqual(hasPermissionOrOwner(regularUser, 0x0000000000002000n, null, mockSettings), false, 'Non-trusted user must fail');
});

// 20. Immunity System Verification
test('Features: Immunity System & Administrator Immunity Protection', () => {
  const immunityService = require('../shared/immunityService');
  const trustedService = require('../shared/trustedService');
  const { PermissionsBitField } = require('discord.js');

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

  // Verify administrator permission grants immunity
  const adminMember = {
    id: 'admin_user_111',
    permissions: {
      has: (flag) => flag === PermissionsBitField.Flags.Administrator
    }
  };
  assert.strictEqual(immunityService.isImmune(adminMember, mockGuild), true, 'Member with Administrator permission must have immunity');

  // Verify administrator role grants immunity
  const adminRoleMember = {
    id: 'admin_role_member_222',
    permissions: {
      has: () => false
    },
    roles: {
      cache: new Map([
        ['role_admin_1', {
          id: 'role_admin_1',
          permissions: {
            has: (flag) => flag === PermissionsBitField.Flags.Administrator
          }
        }]
      ])
    }
  };
  assert.strictEqual(immunityService.isImmune(adminRoleMember, mockGuild), true, 'Member with Administrator role must have immunity');

  // Verify trusted member has immunity
  const trustedSettings = { trustedMembers: ['trusted_vip_123'] };
  assert.strictEqual(immunityService.isImmune('trusted_vip_123', mockGuild, null, trustedSettings), true, 'Trusted member must have immunity');
  assert.strictEqual(immunityService.isImmune('random_user_555', mockGuild, null, trustedSettings), false, 'Non-trusted member must not have immunity');
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
  assert.ok(typeof autodltCmd.executePrefix === 'function');

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
    assert.strictEqual(serverTagCmd.name, 'servertag');
    assert.ok(typeof serverTagCmd.executePrefix === 'function');

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

  // 24. Bulk Emoji Stealer & Add Below (+addemj)
  await asyncTest('Features: Bulk Emoji Stealer & Add Below (+addemj)', async () => {
    const addemjCmd = require('../bot/commands/utility/addemj');
    const emojiManager = require('../bot/modules/emojiManager');
    const { PermissionsBitField } = require('discord.js');

    // 1. Verify command metadata & aliases
    assert.strictEqual(addemjCmd.name, 'addemj');
    assert.ok(addemjCmd.aliases.includes('addemoji'));
    assert.ok(addemjCmd.aliases.includes('emj'));
    assert.ok(addemjCmd.aliases.includes('stealall'));
    assert.ok(addemjCmd.aliases.includes('addemojis'));
    assert.strictEqual(addemjCmd.name, 'addemj');
    assert.ok(typeof addemjCmd.executePrefix === 'function');

    // 2. Setup mock guild & channel with message history
    const createdEmojis = [];
    const mockGuild = {
      id: 'guild_emoji_test',
      name: 'Emoji Test Guild',
      premiumTier: 0,
      emojis: {
        cache: new Map(),
        create: async (data) => {
          createdEmojis.push(data);
          const emojiObj = {
            id: `emj_${createdEmojis.length}`,
            name: data.name,
            animated: data.name.includes('cat'),
            toString() { return `<${this.animated ? 'a' : ''}:${this.name}:${this.id}>`; }
          };
          mockGuild.emojis.cache.set(emojiObj.id, emojiObj);
          return emojiObj;
        }
      },
      members: {
        fetchMe: async () => ({
          permissions: {
            has: (perm) => true
          }
        })
      }
    };

    const targetMsg = {
      id: 'msg_target_1',
      createdTimestamp: 1000,
      content: 'Here is an emoji <:pepe_happy:102030405060708090>',
      attachments: new Map()
    };
    const belowMsg1 = {
      id: 'msg_below_1',
      createdTimestamp: 2000,
      content: 'And another one <a:party_cat:908070605040302010>',
      attachments: new Map()
    };
    const belowMsg2 = {
      id: 'msg_below_2',
      createdTimestamp: 3000,
      content: 'Check this image!',
      attachments: new Map([
        ['att_1', { url: 'https://example.com/custom_badge.png' }]
      ])
    };
    const cmdMsg = {
      id: 'msg_cmd_1',
      createdTimestamp: 4000,
      content: '+addemj',
      reference: { messageId: 'msg_target_1' },
      attachments: new Map(),
      guild: mockGuild,
      author: { id: '1487429529717706842', tag: 'Dev#0001', username: 'Dev', displayAvatarURL: () => 'https://example.com/dev.png' },
      member: {
        id: '1487429529717706842',
        user: { id: '1487429529717706842' },
        permissions: {
          has: (perm) => false // User lacks Manage Expressions directly, but is Developer -> bypass!
        }
      }
    };

    const mockChannel = {
      id: 'chan_emj_1',
      messages: {
        fetch: async (opts) => {
          if (typeof opts === 'string') {
            if (opts === 'msg_target_1') return targetMsg;
            return null;
          }
          if (opts && opts.after === 'msg_target_1') {
            return new Map([
              [belowMsg1.id, belowMsg1],
              [belowMsg2.id, belowMsg2],
              [cmdMsg.id, cmdMsg]
            ]);
          }
          return new Map();
        }
      }
    };
    cmdMsg.channel = mockChannel;

    let replySent = null;
    let editedResult = null;
    let progressCalls = 0;

    cmdMsg.reply = async (payload) => {
      replySent = payload;
      return {
        edit: async (editPayload) => {
          if (typeof editPayload === 'string' || (editPayload.content && !editPayload.embeds)) {
            progressCalls++;
          }
          editedResult = editPayload;
          return editedResult;
        }
      };
    };

    // Execute +addemj prefix command
    await addemjCmd.executePrefix(cmdMsg, [], { owners: ['1487429529717706842'] }, {});

    // Assert: statusMsg was sent, emojis were uploaded, progress/result embed was generated
    assert.ok(replySent, 'Initial status message must be replied');
    assert.strictEqual(createdEmojis.length, 3, 'All 3 emojis/images from target + below messages must be added');
    assert.strictEqual(createdEmojis[0].name, 'pepe_happy');
    assert.strictEqual(createdEmojis[1].name, 'party_cat');
    assert.strictEqual(createdEmojis[2].name, 'custom_badge');
    assert.ok(editedResult, 'Final edited message must exist');
    assert.ok(editedResult.embeds && editedResult.embeds.length === 1, 'Final result must include summary embed');

    // Test permission check failure for non-developer / non-admin
    const nonPermMemberMsg = {
      ...cmdMsg,
      author: { id: 'regular_user_11', tag: 'User#1234', username: 'User' },
      member: {
        permissions: {
          has: () => false
        }
      },
      reply: async (msg) => {
        return { content: msg };
      }
    };
    const deniedReply = await addemjCmd.executePrefix(nonPermMemberMsg, [], { owners: ['1487429529717706842'] }, {});
    assert.ok(deniedReply.content.includes('Manage Expressions / Emojis'), 'Must reject user lacking permissions');
  });

  // 25. Interactive Leveling Hub & Admin-Only Visibility Controls
  await asyncTest('Features: Interactive Leveling Hub & Admin-Only Visibility Controls', async () => {
    const levelingHub = require('../bot/modules/levelingHub');
    const levelCmd = require('../bot/commands/leveling/levelsettings');
    const UserXP = require('../models/UserXP');
    const Guild = require('../models/Guild');

    const origGuildFindOne = Guild.findOne;
    const origUserXpFindOne = UserXP.findOne;
    const origUserXpCount = UserXP.countDocuments;
    Guild.findOne = async () => mockGuildDoc;
    UserXP.findOne = () => {
      const p = Promise.resolve({ xp: 120, level: 2, totalMessages: 15 });
      p.sort = () => p;
      return p;
    };
    UserXP.countDocuments = async () => 3;

    // 1. Verify Command Aliases & Setup
    assert.strictEqual(levelCmd.name, 'levels');
    assert.ok(levelCmd.aliases.includes('level'));
    assert.ok(levelCmd.aliases.includes('xp'));
    assert.ok(levelCmd.aliases.includes('leveling'));

    const mockGuild = {
      id: 'guild_level_hub_1',
      name: 'Hub Test Guild',
      iconURL: () => 'https://example.com/icon.png',
      roles: {
        cache: new Map([
          ['role_vip_1', { id: 'role_vip_1', name: 'VIP Level 5' }]
        ])
      }
    };
    const mockGuildDoc = {
      leveling: {
        enabled: true,
        xpMin: 20,
        xpMax: 35,
        cooldownSeconds: 45,
        announcementChannelId: 'chan_ann_1',
        roleRewards: [{ level: 5, roleId: 'role_vip_1' }]
      }
    };
    const mockUser = { id: 'member_user_1', username: 'MemberTester', displayAvatarURL: () => 'https://example.com/avatar.png' };

    // 2. Non-Admin View: Admin controls are NOT visible in dropdown or buttons
    const regularComponents = levelingHub.buildHubComponents(false, mockGuildDoc);
    assert.strictEqual(regularComponents.length, 2, 'Regular members see dropdown + member buttons row');
    const regularDropdownOptions = regularComponents[0].components[0].options.map(o => o.data.value);
    assert.deepStrictEqual(regularDropdownOptions, ['act_myrank', 'act_leaderboard', 'act_rewards']);
    assert.ok(!regularDropdownOptions.includes('act_toggle'), 'Admin toggle must be hidden from regular dropdown');
    assert.ok(!regularDropdownOptions.includes('act_rates'), 'Admin rates must be hidden from regular dropdown');

    const memberButtonIds = regularComponents[1].components.map(b => b.data.custom_id);
    assert.deepStrictEqual(memberButtonIds, ['btn_level_myrank', 'btn_level_leaderboard', 'btn_level_rewards']);
    assert.ok(!memberButtonIds.includes('btn_level_toggle'), 'Admin toggle button must be hidden from regular members');
    assert.ok(!memberButtonIds.includes('btn_level_open_rates'), 'Admin rates must be hidden');
    assert.ok(!memberButtonIds.includes('btn_level_addxp'), 'Admin give XP must be hidden');
    assert.ok(!memberButtonIds.includes('btn_level_reset'), 'Admin reset XP must be hidden');

    // 3. Admin View: Both Member controls AND Admin action controls are visible
    const adminComponents = levelingHub.buildHubComponents(true, mockGuildDoc);
    assert.strictEqual(adminComponents.length, 4, 'Administrators must see Dropdown, Member row, Admin settings row, and Admin XP tools row');
    const adminDropdownOptions = adminComponents[0].components[0].options.map(o => o.data.value);
    assert.ok(adminDropdownOptions.includes('act_toggle'));
    assert.ok(adminDropdownOptions.includes('act_channel_picker'));
    assert.ok(adminDropdownOptions.includes('act_rates'));
    assert.ok(adminDropdownOptions.includes('act_add_reward'));
    assert.ok(adminDropdownOptions.includes('act_give_xp'));
    assert.ok(adminDropdownOptions.includes('act_deduct_xp'));
    assert.ok(adminDropdownOptions.includes('act_reset_xp'));

    // 4. Verify Embed Contains Server Leveling Setup & Guidance
    const hubEmbed = await levelingHub.buildHubEmbed(mockGuild, mockGuildDoc, mockUser, true);
    assert.ok(hubEmbed.data.title.includes('Leveling & XP System'));
    assert.ok(hubEmbed.data.fields.find(f => f.name.includes('Server Leveling Setup')));
    const setupField = hubEmbed.data.fields.find(f => f.name.includes('Server Leveling Setup'));
    assert.ok(setupField.value.includes('20 - 35 XP'));
    assert.ok(setupField.value.includes('45 seconds'));
    assert.ok(setupField.value.includes('chan_ann_1'));

    // 5. Test Button Action: Non-admin trying to click an admin button gets rejected
    let replyPayload = null;
    const fakeInteraction = {
      customId: 'btn_level_setup',
      guild: mockGuild,
      user: mockUser,
      member: {
        id: mockUser.id,
        permissions: { has: () => false }
      },
      reply: async (payload) => {
        replyPayload = payload;
        return payload;
      }
    };
    await levelingHub.handleButton(fakeInteraction, {});
    assert.ok(replyPayload && replyPayload.content.includes('reserved for **Administrators**'), 'Must block non-admin clicking admin button');

    // 6. Test Member Button: My Rank Card works for everyone
    let rankReply = null;
    const memberInteraction = {
      customId: 'btn_level_myrank',
      guild: mockGuild,
      user: mockUser,
      member: {
        id: mockUser.id,
        permissions: { has: () => false }
      },
      reply: async (payload) => {
        rankReply = payload;
        return payload;
      }
    };
    await levelingHub.handleButton(memberInteraction, {});
    assert.ok(rankReply && rankReply.embeds && rankReply.embeds.length === 1, 'My Rank button must return personal rank embed');
    assert.strictEqual(rankReply.ephemeral, true, 'My Rank response should be ephemeral to keep chat clean');

    // Restore stubs
    Guild.findOne = origGuildFindOne;
    UserXP.findOne = origUserXpFindOne;
    UserXP.countDocuments = origUserXpCount;
  });

  // 30. All-in-One Categorized Interactive Guidance Hubs & Permission Filtering
  test('Features: Categorized Interactive Guidance Hubs (Birthdays, Voice, Tickets, Server Tools, Minigames)', async () => {
    const birthdayHub = require('../bot/modules/birthdayHub');
    const voiceHub = require('../bot/modules/voiceHub');
    const ticketHub = require('../bot/modules/ticketHub');
    const serverToolsHub = require('../bot/modules/serverToolsHub');
    const gamesHub = require('../bot/modules/gamesHub');
    const Birthday = require('../models/Birthday');
    const TempVoice = require('../models/TempVoice');
    const Ticket = require('../models/Ticket');

    // Mock models
    const origBdayCount = Birthday.countDocuments;
    const origBdayFindOne = Birthday.findOne;
    const origBdayFind = Birthday.find;
    const origTvCount = TempVoice.countDocuments;
    const origTvFindOne = TempVoice.findOne;
    const origTicketCount = Ticket.countDocuments;
    const origTicketFind = Ticket.find;
    const origTicketFindOne = Ticket.findOne;

    Birthday.countDocuments = async () => 12;
    Birthday.findOne = async () => ({
      userId: 'user_regular_1',
      day: 24,
      month: 10,
      year: 2000,
      timezone: 'Asia/Kolkata'
    });
    Birthday.find = () => ({
      sort: () => ({
        limit: async () => [
          { userId: 'user_regular_1', day: 24, month: 10, timezone: 'Asia/Kolkata' }
        ]
      })
    });

    TempVoice.countDocuments = async () => 3;
    TempVoice.findOne = async () => null;

    Ticket.countDocuments = async () => 5;
    Ticket.find = () => ({
      limit: async () => []
    });
    Ticket.findOne = async () => null;

    const mockGuild = {
      id: 'guild_hub_test',
      name: 'AURA Hub Test Community',
      voiceStates: { cache: new Map() },
      roles: { cache: new Map([['role_star', { id: 'role_star', name: 'Star' }]]) },
      members: { cache: new Map() },
      channels: { cache: new Map() }
    };
    const mockUser = { id: 'user_regular_1', username: 'TestUser' };
    const mockMember = { id: 'user_regular_1', user: mockUser, permissions: { has: () => false } };
    const mockGuildDoc = {
      guildId: mockGuild.id,
      birthdays: { enabled: true, wishChannelId: 'chan_bday_wish', setChannelId: 'chan_bday_input', roleId: 'role_star' },
      joinToCreate: { enabled: true, channelId: 'chan_jtc_trigger', categoryId: 'cat_jtc' },
      tickets: { enabled: true, categoryId: 'cat_tickets', staffRoleId: 'role_staff' },
      serverTagRole: { enabled: true, roleId: 'role_star', activeMemberCount: 15 },
      countingGame: { enabled: true, channelId: 'chan_count', currentNumber: 42, highScore: 100 },
      wordChainGame: { enabled: true, channelId: 'chan_chain', lastWord: 'apple', currentStreak: 5, highScore: 25 }
    };

    // A. Test Birthday Hub
    const bdayEmbed = await birthdayHub.buildHubEmbed(mockGuild, mockGuildDoc, mockUser, false);
    assert.ok(bdayEmbed.data.title.includes('Birthday System'));
    assert.ok(bdayEmbed.data.fields.find(f => f.name.includes('Server Birthday Setup')));
    assert.ok(bdayEmbed.data.fields.find(f => f.name.includes('Your Birthday')));

    const bdayMemberComponents = birthdayHub.buildHubComponents(false, mockGuildDoc);
    assert.strictEqual(bdayMemberComponents.length, 2, 'Regular members only see 2 rows (select menu + member buttons)');
    const bdayAdminComponents = birthdayHub.buildHubComponents(true, mockGuildDoc);
    assert.strictEqual(bdayAdminComponents.length, 3, 'Admins see 3 rows including admin quick buttons');

    // B. Test Voice Hub
    const vcEmbed = await voiceHub.buildHubEmbed(mockGuild, mockGuildDoc, mockMember, false);
    assert.ok(vcEmbed.data.title.includes('Voice System & Lounges'));
    assert.ok(vcEmbed.data.fields.find(f => f.name.includes('Join-to-Create Voice Setup')));

    const vcMemberComponents = voiceHub.buildHubComponents(mockMember, false, mockGuildDoc, null, null);
    assert.strictEqual(vcMemberComponents.length, 2, 'Regular members not in lounge see 2 rows');
    const vcAdminComponents = voiceHub.buildHubComponents(mockMember, true, mockGuildDoc, null, null);
    assert.strictEqual(vcAdminComponents.length, 3, 'Admins see 3 rows including admin mass action buttons');

    // C. Test Ticket Hub
    const ticketEmbed = await ticketHub.buildHubEmbed(mockGuild, mockGuildDoc, mockUser, false);
    assert.ok(ticketEmbed.data.title.includes('Support & Ticket System'));
    assert.ok(ticketEmbed.data.fields.find(f => f.name.includes('Server Ticket Setup')));

    const ticketMemberComponents = ticketHub.buildHubComponents(mockUser, false, mockGuildDoc, null);
    assert.strictEqual(ticketMemberComponents.length, 2, 'Members see 2 rows');
    const ticketAdminComponents = ticketHub.buildHubComponents(mockUser, true, mockGuildDoc, null);
    assert.strictEqual(ticketAdminComponents.length, 3, 'Admins see 3 rows with deploy panel & setup');

    // D. Test Server Tools Hub
    const toolsEmbed = await serverToolsHub.buildHubEmbed(mockGuild, mockGuildDoc, mockUser, false);
    assert.ok(toolsEmbed.data.title.includes('Server Tools & Growth Hub'));
    assert.ok(toolsEmbed.data.fields.find(f => f.name.includes('Server Tag Auto-Role')));
    assert.ok(toolsEmbed.data.fields.find(f => f.name.includes('Live Server Stat Counters')));

    const toolsMemberComponents = serverToolsHub.buildHubComponents(false, mockGuildDoc);
    const toolsAdminComponents = serverToolsHub.buildHubComponents(true, mockGuildDoc);
    assert.ok(toolsAdminComponents[0].components[0].data.options.some(o => o.value === 'act_tools_sync_tag'));
    assert.ok(!toolsMemberComponents[0].components[0].data.options.some(o => o.value === 'act_tools_sync_tag'), 'Non-admins must not see sync tag action');

    // E. Test Minigames Hub
    const gamesEmbed = await gamesHub.buildHubEmbed(mockGuild, mockGuildDoc, mockUser, false);
    assert.ok(gamesEmbed.data.title.includes('Minigames & Activity'));
    assert.ok(gamesEmbed.data.fields.find(f => f.name.includes('Counting Game')));
    assert.ok(gamesEmbed.data.fields.find(f => f.name.includes('Word Chain Challenge')));

    const gamesMemberComponents = gamesHub.buildHubComponents(false, mockGuildDoc);
    assert.strictEqual(gamesMemberComponents.length, 2, 'Members see 2 rows (select menu + quick game buttons)');
    const gamesAdminComponents = gamesHub.buildHubComponents(true, mockGuildDoc);
    assert.strictEqual(gamesAdminComponents.length, 3, 'Admins see 3 rows including setup channels row');

    // Restore stubs
    Birthday.countDocuments = origBdayCount;
    Birthday.findOne = origBdayFindOne;
    Birthday.find = origBdayFind;
    TempVoice.countDocuments = origTvCount;
    TempVoice.findOne = origTvFindOne;
    Ticket.countDocuments = origTicketCount;
    Ticket.find = origTicketFind;
    Ticket.findOne = origTicketFindOne;
  });

  // 31. Core Database Management, Health & Backup/Restore
  test('Core: Database Health, Migrations & Backup/Restore Service', async () => {
    const { getDatabaseHealth } = require('../shared/database');
    const backupService = require('../shared/backupService');
    const DatabaseBackup = require('../models/DatabaseBackup');

    // 1. Test database health structure
    const health = await getDatabaseHealth();
    assert.ok(health.status, 'Health report must contain status');
    assert.ok(['healthy', 'degraded', 'unhealthy'].includes(health.status));
    assert.ok(health.state, 'State string must be present');

    // 2. Test Backup creation mock
    const origCreate = DatabaseBackup.create;
    const origFind = DatabaseBackup.find;
    const origFindOne = DatabaseBackup.findOne;

    let createdBackup = null;
    DatabaseBackup.create = async (payload) => {
      createdBackup = { ...payload };
      return createdBackup;
    };
    DatabaseBackup.find = () => ({
      sort: () => ({
        lean: async () => [
          { backupId: 'backup_test_1', name: 'Test Backup', totalDocuments: 42, sizeBytes: 1024, createdAt: new Date() }
        ]
      })
    });
    DatabaseBackup.findOne = () => ({
      lean: async () => ({
        backupId: 'backup_test_1',
        data: { guilds: [], user_xp: [] }
      })
    });

    const backupResult = await backupService.createBackup({ name: 'Automated Unit Backup' });
    assert.ok(backupResult.backupId.startsWith('backup_'), 'Backup ID must have valid format');
    assert.strictEqual(backupResult.name, 'Automated Unit Backup');

    // 3. Test listing backups
    const list = await backupService.listBackups();
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].backupId, 'backup_test_1');

    // 4. Test restore without confirmation fails
    let threwError = false;
    try {
      await backupService.restoreBackup('backup_test_1', { confirm: false });
    } catch (e) {
      threwError = true;
      assert.ok(e.message.includes('Confirmation parameter'), 'Must reject unconfirmed restore');
    }
    assert.strictEqual(threwError, true, 'Restore without confirm: true must throw');

    // 5. Test restore with confirmation succeeds
    const restoreResult = await backupService.restoreBackup('backup_test_1', { confirm: true });
    assert.strictEqual(restoreResult.success, true);
    assert.strictEqual(restoreResult.backupId, 'backup_test_1');

    DatabaseBackup.create = origCreate;
    DatabaseBackup.find = origFind;
    DatabaseBackup.findOne = origFindOne;
  });

  // 32. Centralized Multi-Level Logging & Sensitive Credential Masking
  test('Core: Centralized Logging, Error Masking & Deduplication', async () => {
    const logger = require('../shared/logger');

    // 1. Test token masking (constructed dynamically to prevent false-positive static secret scanning)
    const part1 = 'mock_sample_token_part1_1234';
    const part2 = 'sample';
    const part3 = 'mock_sample_token_part3_longer_than_27_chars';
    const fakeToken = `${part1}.${part2}.${part3}`;
    const fakeMongoUri = 'mongodb+srv://aura_admin:superSecretPassword123@cluster0.abcde.mongodb.net/aura_db';
    const fakeWebhook = 'https://discord.com/api/webhooks/1234567890/tokenABCDEF123456';
    const fakeSecret = 'client_secret=secretKeyXYZ987654';

    const sampleLog = `Connected bot token: ${fakeToken} with DB: ${fakeMongoUri} and webhook ${fakeWebhook} with ${fakeSecret}`;
    const sanitized = logger.maskSensitive(sampleLog);

    assert.ok(!sanitized.includes(fakeToken), 'Bot token must be masked');
    assert.ok(!sanitized.includes('superSecretPassword123'), 'DB password must be masked');
    assert.ok(!sanitized.includes('tokenABCDEF123456'), 'Webhook secret must be masked');
    assert.ok(!sanitized.includes('secretKeyXYZ987654'), 'OAuth2 secret must be masked');
    assert.ok(sanitized.includes('DISCORD_TOKEN_REDACTED'));
    assert.ok(sanitized.includes('****@'));

    // 2. Test error deduplication
    const errKey = 'test_err_key_unique_123';
    assert.strictEqual(logger.shouldSuppressDuplicate(errKey), false, 'First occurrence should not be suppressed');
    assert.strictEqual(logger.shouldSuppressDuplicate(errKey), true, 'Immediate subsequent occurrence must be suppressed');
  });

  // 33. Security System, Rate Limiting & Developer Access Guard
  test('Core: Security System, Rate Limiting & Developer Access Guard', async () => {
    const { requireDeveloper, sanitizeInput } = require('../api/middleware/security');

    // 1. Test unauthorized user trying to access developer middleware
    let statusCode = null;
    let jsonResponse = null;
    const regularRes = {
      status: (code) => { statusCode = code; return regularRes; },
      json: (data) => { jsonResponse = data; return regularRes; }
    };
    const regularReq = {
      session: {
        user: { id: 'regular_user_999', username: 'RandomGuy' }
      }
    };
    let nextCalled = false;
    requireDeveloper(regularReq, regularRes, () => { nextCalled = true; });
    assert.strictEqual(statusCode, 403, 'Regular user must receive 403 Forbidden');
    assert.strictEqual(nextCalled, false, 'Next must not be called for non-developer');

    // 2. Test developer access
    const devReq = {
      session: {
        user: { id: '1487429529717706842', username: 'redflash00' }
      }
    };
    let devNextCalled = false;
    requireDeveloper(devReq, regularRes, () => { devNextCalled = true; });
    assert.strictEqual(devNextCalled, true, 'Developer must pass through requireDeveloper');

    // 3. Test input sanitization (prototype pollution protection)
    const dirtyReq = {
      body: {
        normalKey: 'safeValue',
        __proto__: { polluted: true },
        nested: { constructor: 'bad', safe: 123 }
      }
    };
    sanitizeInput(dirtyReq, {}, () => {});
    assert.strictEqual(dirtyReq.body.normalKey, 'safeValue');
    assert.strictEqual(dirtyReq.body.nested.safe, 123);
    assert.strictEqual(dirtyReq.body.__proto__.polluted, undefined);
  });

  // 34. Maintenance Mode, Blacklist System, Cooldown Engine & Localization
  test('Core: Maintenance Mode, Blacklist, Command Cooldowns & Localization', async () => {
    const maintenanceService = require('../shared/maintenanceService');
    const blacklistService = require('../shared/blacklistService');
    const cooldownService = require('../shared/cooldownService');
    const i18n = require('../shared/i18n');
    const SystemConfig = require('../models/SystemConfig');
    const Blacklist = require('../models/Blacklist');

    // Stub DB updates
    const origConfigUpdate = SystemConfig.updateOne;
    const origBlFindOneAndUpdate = Blacklist.findOneAndUpdate;
    const origBlFindOneAndDelete = Blacklist.findOneAndDelete;
    SystemConfig.updateOne = async () => ({ acknowledged: true });
    Blacklist.findOneAndUpdate = async (q, u) => u;
    Blacklist.findOneAndDelete = async () => ({ targetId: 'user_bad_1' });

    // 1. Maintenance Mode
    await maintenanceService.enableMaintenance({ message: 'Custom Maintenance Test', updatedBy: 'TestDev' });
    assert.strictEqual(maintenanceService.isMaintenanceActive(), true);
    assert.strictEqual(maintenanceService.canBypassMaintenance('1487429529717706842'), true);
    assert.strictEqual(maintenanceService.canBypassMaintenance('regular_user_999'), false);
    await maintenanceService.disableMaintenance({ updatedBy: 'TestDev' });
    assert.strictEqual(maintenanceService.isMaintenanceActive(), false);

    // 2. Blacklist System
    await blacklistService.addBlacklist({
      targetId: 'user_bad_1',
      type: 'user',
      reason: 'Spamming interactions',
      blacklistedBy: '1487429529717706842'
    });
    const check1 = blacklistService.isBlacklisted('user_bad_1', null);
    assert.strictEqual(check1.blacklisted, true);
    assert.strictEqual(check1.type, 'user');

    const checkSafe = blacklistService.isBlacklisted('user_clean_999', 'guild_clean_888');
    assert.strictEqual(checkSafe.blacklisted, false);

    await blacklistService.removeBlacklist('user_bad_1');
    const checkAfterRemove = blacklistService.isBlacklisted('user_bad_1', null);
    assert.strictEqual(checkAfterRemove.blacklisted, false);

    // 3. Command Cooldowns
    const cd1 = cooldownService.checkCooldown({
      commandName: 'testcmd',
      userId: 'user_cd_1',
      durationSeconds: 2
    });
    assert.strictEqual(cd1, null, 'First execution should have no cooldown');

    const cd2 = cooldownService.checkCooldown({
      commandName: 'testcmd',
      userId: 'user_cd_1',
      durationSeconds: 2
    });
    assert.ok(cd2 !== null, 'Immediate second execution must return cooldown');
    assert.ok(Number(cd2.remainingSeconds) > 0);

    // Bypassed for Bot Developer
    const cdDev = cooldownService.checkCooldown({
      commandName: 'testcmd',
      userId: '1487429529717706842',
      durationSeconds: 2
    });
    assert.strictEqual(cdDev, null, 'Bot developer must bypass cooldowns');

    // 4. Localization Engine (i18n)
    const msg = i18n.t('common.cooldown', { seconds: '3.5', command: 'ping' });
    assert.ok(msg.includes('3.5s'));
    assert.ok(msg.includes('ping'));

    const levelMsg = i18n.t('leveling.levelUp', { user: '@Gokul', level: '10' });
    assert.ok(levelMsg.includes('@Gokul'));
    assert.ok(levelMsg.includes('Level 10'));

    // Restore stubs
    SystemConfig.updateOne = origConfigUpdate;
    Blacklist.findOneAndUpdate = origBlFindOneAndUpdate;
    Blacklist.findOneAndDelete = origBlFindOneAndDelete;
  });

  // 35. Moderation Hub & Clean System Diagnostics
  await test('Interactive Moderation Hub & System Diagnostics Hub (/mod & /system)', async () => {
    const moderationHub = require('../bot/modules/moderationHub');
    const modCmd = require('../bot/commands/moderation/mod');
    const systemCmd = require('../bot/commands/general/system');

    assert.strictEqual(modCmd.data.name, 'mod');
    assert.strictEqual(systemCmd.data.name, 'system');

    const mockGuild = { id: 'g_hub_test', name: 'Hub Test Guild' };
    const mockUser = { id: 'u_1', username: 'MemberOne' };
    const mockDoc = {
      autoDelete: { enabled: true, targets: [{ userId: 'target_1', channelId: null, expiresAt: new Date(Date.now() + 60000) }] },
      stickyMessages: [{ channelId: 'c_1', title: 'Rules', text: 'Be kind' }]
    };

    // Embed validation
    const embedAdmin = await moderationHub.buildHubEmbed(mockGuild, mockDoc, mockUser, true);
    assert.ok(embedAdmin.data.title.includes('Moderation & Chat Protection Hub'));
    assert.ok(embedAdmin.data.fields.some(f => f.name.includes('Purge & Chat Cleaning')));
    assert.ok(embedAdmin.data.fields.some(f => f.name.includes('1-Second Auto-Delete')));

    // Component validation: admin vs member
    const adminComps = moderationHub.buildHubComponents(true);
    assert.ok(adminComps.length >= 2, 'Admin components should include select menu and action buttons');
    assert.ok(adminComps[0].components[0].data.options.some(o => o.value === 'mod_purge_prompt'));

    const memberComps = moderationHub.buildHubComponents(false);
    assert.strictEqual(memberComps.length, 0, 'Non-staff members should see no admin action buttons');
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
