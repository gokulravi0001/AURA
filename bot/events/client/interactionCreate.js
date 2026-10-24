const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const logger = require('../../../shared/logger');
const guildService = require('../../../shared/guildService');
const { COLORS } = require('../../../shared/constants');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      // 1. Handle Slash Commands
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
          return interaction.reply({
            content: '❌ This command does not exist or has been removed.',
            ephemeral: true
          });
        }

        // Guild Check
        const settings = interaction.guildId
          ? await guildService.getSettings(interaction.guildId)
          : null;

        // Module enabled check if command belongs to a specific module
        let sub = null;
        try { sub = interaction.options.getSubcommand(false); } catch (e) {}

        const isSetupSubcommand = ['setup', 'set', 'panel', 'enable', 'config', 'status', 'view', 'list'].includes(sub);
        const isAdmin = interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator);

        if (command.module && settings && settings.modules && settings.modules[command.module] === false) {
          if (isAdmin || isSetupSubcommand) {
            // Auto re-enable module when administrator configures or runs it
            settings.modules[command.module] = true;
            const Guild = require('../../../models/Guild');
            await Guild.updateOne(
              { guildId: interaction.guildId },
              { $set: { [`modules.${command.module}`]: true } },
              { upsert: true }
            ).catch(() => {});
          } else {
            return interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setColor(COLORS.ERROR)
                  .setTitle('⚠️ Module Disabled')
                  .setDescription(`The **${command.module}** module is currently disabled on this server. An administrator can enable or configure it using \`/${command.name} setup\`.`)
              ],
              ephemeral: true
            });
          }
        }

        // Permission check
        if (command.permissions && interaction.member) {
          const missing = [];
          for (const perm of command.permissions) {
            if (!interaction.member.permissions.has(perm)) {
              missing.push(perm);
            }
          }
          if (missing.length > 0 && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({
              content: `🚫 You lack the required permissions to use this command: \`${missing.join(', ')}\``,
              ephemeral: true
            });
          }
        }

        await command.execute(interaction, client, settings);
      }

      // 2. Handle Buttons
      else if (interaction.isButton()) {
        const customId = interaction.customId;

        // Ticket interactions: ticket_create, ticket_claim, ticket_close, ticket_delete, ticket_reopen
        if (customId.startsWith('ticket_')) {
          const ticketHandler = require('../../modules/ticketManager');
          await ticketHandler.handleButton(interaction, client);
          return;
        }

        // Game interactions: game_rps_, game_ttt_
        if (customId.startsWith('game_')) {
          const gamesManager = require('../../modules/gamesManager');
          await gamesManager.handleButton(interaction, client);
          return;
        }

        // Bump manual confirmation button: bump_confirm
        if (customId === 'bump_confirm') {
          const bumpService = require('../../modules/bumpService');
          await bumpService.handleConfirmButton(interaction, client);
          return;
        }

        // Custom registered button handlers
        const handler = client.buttons.get(customId);
        if (handler) {
          await handler(interaction, client);
        }
      }

      // 3. Handle Modals
      else if (interaction.isModalSubmit()) {
        const customId = interaction.customId;

        // Birthday registration modal
        if (customId === 'modal_birthday_register') {
          const birthdayService = require('../../modules/birthdayService');
          await birthdayService.handleModalSubmit(interaction, client);
          return;
        }

        // Ticket creation modal
        if (customId.startsWith('modal_ticket_')) {
          const ticketHandler = require('../../modules/ticketManager');
          await ticketHandler.handleModal(interaction, client);
          return;
        }

        const handler = client.modals.get(customId);
        if (handler) {
          await handler(interaction, client);
        }
      }

      // 4. Handle String Select Menus
      else if (interaction.isStringSelectMenu()) {
        const customId = interaction.customId;
        const handler = client.selectMenus.get(customId);
        if (handler) {
          await handler(interaction, client);
        }
      }
    } catch (err) {
      logger.error('Error handling interaction:', err);
      const errorEmbed = new EmbedBuilder()
        .setColor(COLORS.ERROR)
        .setTitle('⚠️ An Unexpected Error Occurred')
        .setDescription('There was an issue executing this interaction. Please try again later.');

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
      }
    }
  }
};
