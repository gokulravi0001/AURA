require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const logger = require('../shared/logger');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const categories = fs.readdirSync(commandsPath);

for (const category of categories) {
  const categoryPath = path.join(commandsPath, category);
  if (!fs.statSync(categoryPath).isDirectory()) continue;

  const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(categoryPath, file);
    const command = require(filePath);
    if (command.data && typeof command.data.toJSON === 'function') {
      commands.push(command.data.toJSON());
    }
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!clientId || !process.env.DISCORD_BOT_TOKEN) {
      logger.error('Missing DISCORD_CLIENT_ID or DISCORD_BOT_TOKEN in .env. Skipping deployment.');
      return;
    }

    logger.info(`Found ${commands.length} current AURA slash commands to register.`);

    // 1. Fetch all guilds the bot belongs to and clear old guild-specific commands
    try {
      const guilds = await rest.get(Routes.userGuilds());
      logger.info(`Checking ${guilds.length} guilds for old/legacy guild commands...`);

      for (const guild of guilds) {
        try {
          const oldGuildCmds = await rest.get(Routes.applicationGuildCommands(clientId, guild.id));
          if (oldGuildCmds && oldGuildCmds.length > 0) {
            logger.info(`Purging ${oldGuildCmds.length} legacy commands from guild: ${guild.name} (${guild.id})`);
            await rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body: [] });
          }
        } catch (e) {
          // Non-critical if bot lacks access to a specific guild's command list
        }
      }
    } catch (err) {
      logger.warn('Could not inspect guild-specific commands:', err.message);
    }

    // 2. Overwrite all Global application commands with ONLY the new AURA commands
    logger.info('Overwriting global application slash commands...');
    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );

    logger.success(`=================================================`);
    logger.success(`  SUCCESSFULLY REPLACED ALL BOT COMMANDS!`);
    logger.success(`  Total Live Slash Commands: ${data.length}`);
    logger.success(`  Registered: ${data.map(c => '/' + c.name).join(', ')}`);
    logger.success(`  MongoDB user data (birthdays, etc.) was NOT touched.`);
    logger.success(`=================================================`);
  } catch (error) {
    logger.error('Error deploying commands:', error);
  }
})();
