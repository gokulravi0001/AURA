const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const counterService = require('../../modules/counterService');
const Guild = require('../../../models/Guild');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('counter')
    .setDescription('Automated server stat counters setup & management (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Automatically create stats category and locked voice counter channels')
    )
    .addSubcommand(sub =>
      sub.setName('update')
        .setDescription('Force an immediate update of all server stat counter channels')
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Delete all voice counter channels and remove category')
    ),
  name: 'counter',
  description: 'Manage automated server voice counters',
  aliases: ['counters', 'counters-setup', 'servercounters'],
  permissions: [PermissionFlagsBits.ManageChannels],
  module: 'voice_counters',

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'setup') {
      await interaction.deferReply();
      try {
        const wizardResult = await counterService.setupWizard(guild);

        await Guild.updateOne(
          { guildId: guild.id },
          {
            $set: {
              'modules.voice_counters': true,
              'voiceCounters.enabled': true,
              'voiceCounters.categoryId': wizardResult.categoryId,
              'voiceCounters.counters': wizardResult.counters
            }
          },
          { upsert: true }
        );

        return interaction.followUp({
          embeds: [
            new EmbedBuilder()
              .setColor(COLORS.SUCCESS)
              .setTitle('📊 Server Stat Counters Created!')
              .setDescription(`Created stats category and **${wizardResult.counters.length} live voice counter channels**:\n` +
                wizardResult.counters.map(c => `• <#${c.channelId}> (${c.type})`).join('\n'))
              .setFooter({ text: 'Channel names will automatically update as counts change!' })
          ]
        });
      } catch (err) {
        return interaction.followUp(`❌ Setup failed: ${err.message}`);
      }
    }

    if (sub === 'update') {
      const guildDoc = await Guild.findOne({ guildId: guild.id });
      if (!guildDoc?.voiceCounters?.enabled) {
        return interaction.reply({ content: '⚠️ Voice counters are not configured on this server. Run `/counter setup` first.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });
      await counterService.updateCounters(guild, guildDoc, true);
      return interaction.followUp('✅ Counter channel names refreshed with latest member counts!');
    }

    if (sub === 'remove') {
      await interaction.deferReply();
      const guildDoc = await Guild.findOne({ guildId: guild.id });
      if (guildDoc?.voiceCounters?.counters) {
        for (const c of guildDoc.voiceCounters.counters) {
          const chan = guild.channels.cache.get(c.channelId);
          if (chan) await chan.delete('Removing server counters').catch(() => {});
        }
      }
      if (guildDoc?.voiceCounters?.categoryId) {
        const cat = guild.channels.cache.get(guildDoc.voiceCounters.categoryId);
        if (cat) await cat.delete('Removing server counters category').catch(() => {});
      }

      guildDoc.voiceCounters.enabled = false;
      guildDoc.voiceCounters.counters = [];
      guildDoc.voiceCounters.categoryId = null;
      await guildDoc.save();

      return interaction.followUp('🗑️ Voice counters removed.');
    }
  },

  async executePrefix(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply('🚫 Manage Channels permission required.');
    }

    const action = args[0]?.toLowerCase();
    const guild = message.guild;

    if (action === 'update' || action === 'refresh') {
      const guildDoc = await Guild.findOne({ guildId: guild.id });
      if (!guildDoc?.voiceCounters?.enabled) {
        return message.reply('⚠️ Voice counters are not configured. Run `+counter setup` first.');
      }
      const reply = await message.reply('⏳ Fetching latest member counts and updating counter channels...');
      await counterService.updateCounters(guild, guildDoc, true);
      return reply.edit('✅ Counter channel names refreshed with latest member counts!');
    }

    if (action === 'remove') {
      const guildDoc = await Guild.findOne({ guildId: guild.id });
      if (guildDoc?.voiceCounters?.counters) {
        for (const c of guildDoc.voiceCounters.counters) {
          const chan = guild.channels.cache.get(c.channelId);
          if (chan) await chan.delete('Removing server counters').catch(() => {});
        }
      }
      if (guildDoc?.voiceCounters?.categoryId) {
        const cat = guild.channels.cache.get(guildDoc.voiceCounters.categoryId);
        if (cat) await cat.delete('Removing server counters category').catch(() => {});
      }
      return message.reply('🗑️ Voice counters removed.');
    }

    // Default: setup wizard
    const reply = await message.reply('⏳ Creating stats category and voice counter channels...');
    try {
      const wizardResult = await counterService.setupWizard(guild);

      await Guild.updateOne(
        { guildId: guild.id },
        {
          $set: {
            'modules.voice_counters': true,
            'voiceCounters.enabled': true,
            'voiceCounters.categoryId': wizardResult.categoryId,
            'voiceCounters.counters': wizardResult.counters
          }
        },
        { upsert: true }
      );

      return reply.edit(`📊 Server stat counters created successfully! Total channels: **${wizardResult.counters.length}**.`);
    } catch (err) {
      return reply.edit(`❌ Setup failed: ${err.message}`);
    }
  }
};
