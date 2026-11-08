const {
  ChannelType,
  PermissionsBitField,
  EmbedBuilder
} = require('discord.js');
const logger = require('../../shared/logger');
const { COLORS } = require('../../shared/constants');
const immunityService = require('../../shared/immunityService');

// Shared Map of active bounces across all command entry points: userId -> State
const activeBounces = new Map();

/**
 * Robust Voice Bounce & Orbit Manager
 * Moves a member across voice channels in rapid, safe succession
 */
const bounceManager = {
  /**
   * Check if a member is currently in an active bounce
   */
  isBouncing(userId) {
    return activeBounces.has(userId);
  },

  /**
   * Stop an active bounce for a member
   */
  stopBounce(userId) {
    const state = activeBounces.get(userId);
    if (state) {
      state.cancel = true;
      return true;
    }
    return false;
  },

  /**
   * Parse rounds count from args array or text input
   */
  parseRounds(args = []) {
    let rounds = 1;

    // 1. Check for count:X or rounds:X or count=X or rounds=X
    for (const a of args) {
      if (typeof a !== 'string') continue;
      const match = a.match(/(?:count|rounds|round|r)[:=](\d+)/i);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val >= 1) {
          return Math.min(100, Math.max(1, val));
        }
      }
    }

    // 2. Check for "count 10" or "rounds 10" or "r 10"
    for (let i = 0; i < args.length; i++) {
      if (typeof args[i] !== 'string') continue;
      const key = args[i].toLowerCase();
      if (['count', 'rounds', 'round', 'r'].includes(key) && args[i + 1]) {
        const val = parseInt(args[i + 1], 10);
        if (!isNaN(val) && val >= 1) {
          return Math.min(100, Math.max(1, val));
        }
      }
    }

    // 3. Check for standalone numbers (skipping Discord IDs which have length > 6)
    for (const a of args) {
      if (typeof a !== 'string') continue;
      if (a.includes('<@') || a.length > 5) continue;
      const parsed = parseInt(a, 10);
      if (!isNaN(parsed) && parsed >= 1) {
        return Math.min(100, Math.max(1, parsed));
      }
    }

    return rounds;
  },

  /**
   * Execute voice bounce tour
   *
   * @param {object} options
   * @param {import('discord.js').Guild} options.guild
   * @param {import('discord.js').GuildMember} options.targetMember
   * @param {import('discord.js').GuildMember} options.botMember
   * @param {number} options.rounds
   * @param {boolean} options.returnToStart
   * @param {string} options.initiatorTag
   * @param {Function} [options.onProgress]
   * @returns {Promise<{ success: boolean, movedCount: number, completedRounds: number, canceled: boolean, error?: string }>}
   */
  async startBounce({
    guild,
    targetMember,
    botMember,
    rounds = 1,
    returnToStart = true,
    initiatorTag = 'Admin',
    onProgress = null
  }) {
    if (!guild || !targetMember) {
      return { success: false, error: 'Target member or guild not found.' };
    }

    if (activeBounces.has(targetMember.id)) {
      return { success: false, error: 'Target member is already in an active voice bounce tour.' };
    }

    // Check Immunity
    if (immunityService.isImmune(targetMember, guild)) {
      return {
        success: false,
        error: `🛡️ **Immunity Protected**: <@${targetMember.id}> possesses **Immunity** and cannot be targeted by the voice bounce command.`
      };
    }

    // Check voice connection
    const currentVoice = guild.voiceStates.cache.get(targetMember.id);
    const startChannelId = currentVoice?.channelId;
    if (!startChannelId) {
      return { success: false, error: `<@${targetMember.id}> is not currently connected to any voice channel.` };
    }

    const startChannel = guild.channels.cache.get(startChannelId);
    if (!startChannel) {
      return { success: false, error: 'Could not resolve member voice channel.' };
    }

    // Find all voice channels the bot can connect & move members in
    const accessibleChannels = [...guild.channels.cache.values()]
      .filter(c =>
        c.isVoiceBased() &&
        c.type === ChannelType.GuildVoice &&
        botMember.permissionsIn(c).has(PermissionsBitField.Flags.Connect) &&
        botMember.permissionsIn(c).has(PermissionsBitField.Flags.MoveMembers)
      )
      .sort((a, b) => a.rawPosition - b.rawPosition);

    if (accessibleChannels.length < 2) {
      return {
        success: false,
        error: 'You need at least **2 accessible voice channels** in this server to bounce a member back and forth.'
      };
    }

    // Build the tour circuit
    // If only 2 channels total (startChannel + 1 other):
    // Circuit per round is: [otherChannel, startChannel] -> real alternating bounce!
    // If more channels:
    // Circuit per round tours all other channels then startChannel -> complete circuit!
    const otherChannels = accessibleChannels.filter(c => c.id !== startChannelId);

    let tourCircuit = [];
    if (otherChannels.length === 1) {
      // 2 voice channels total: bounce between other and start channel
      tourCircuit = [otherChannels[0], startChannel];
    } else {
      // Multiple voice channels: tour through other channels, then return through startChannel
      const cappedOthers = otherChannels.slice(0, 14);
      tourCircuit = [...cappedOthers, startChannel];
    }

    const state = {
      cancel: false,
      currentRound: 1,
      totalRounds: rounds,
      targetId: targetMember.id,
      startedAt: Date.now()
    };
    activeBounces.set(targetMember.id, state);

    let movedCount = 0;
    let completedRounds = 0;

    try {
      for (let r = 1; r <= rounds; r++) {
        if (state.cancel) break;
        state.currentRound = r;

        let roundFinished = true;

        for (const ch of tourCircuit) {
          if (state.cancel) {
            roundFinished = false;
            break;
          }

          // Verify member is still connected in voice
          const vState = guild.voiceStates.cache.get(targetMember.id);
          if (!vState || !vState.channelId) {
            // Give 500ms grace period in case gateway event is slightly delayed
            await new Promise(res => setTimeout(res, 500));
            const recheck = guild.voiceStates.cache.get(targetMember.id);
            if (!recheck || !recheck.channelId) {
              logger.info(`[VoiceBounce] Member ${targetMember.id} disconnected from voice. Ending bounce.`);
              roundFinished = false;
              state.cancel = true;
              break;
            }
          }

          // If member is already in destination channel, skip redundant call
          if (guild.voiceStates.cache.get(targetMember.id)?.channelId === ch.id) {
            continue;
          }

          try {
            await targetMember.voice.setChannel(
              ch.id,
              `Voice bounce round ${r}/${rounds} initiated by ${initiatorTag}`
            );
            movedCount++;
          } catch (err) {
            // User disconnected from voice
            if (err.code === 40032 || err.message?.toLowerCase().includes('not in a voice channel')) {
              roundFinished = false;
              state.cancel = true;
              break;
            }
            // Discord rate limit (429) -> pause briefly
            if (err.status === 429 || err.code === 429) {
              await new Promise(res => setTimeout(res, 1200));
            }
          }

          // 800ms delay between voice moves (prevents Discord rate limits while keeping bounce fast)
          await new Promise(res => setTimeout(res, 800));
        }

        if (state.cancel) break;
        if (roundFinished) completedRounds++;

        // Send progress callback every 3 rounds or at end
        if (typeof onProgress === 'function' && rounds > 1 && (r % 3 === 0 || r === rounds)) {
          try {
            await onProgress(completedRounds, rounds, movedCount);
          } catch (_) {}
        }
      }

      // Final return to start channel if configured
      if (returnToStart && !state.cancel) {
        const finalVoice = guild.voiceStates.cache.get(targetMember.id);
        if (finalVoice?.channelId && finalVoice.channelId !== startChannelId) {
          await targetMember.voice.setChannel(startChannelId).catch(() => {});
        }
      }
    } finally {
      activeBounces.delete(targetMember.id);
    }

    return {
      success: true,
      movedCount,
      completedRounds,
      totalRounds: rounds,
      canceled: state.cancel,
      startChannelId
    };
  }
};

module.exports = bounceManager;
