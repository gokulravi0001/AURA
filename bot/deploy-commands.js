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

    // 1. Overwrite all Global application commands with the new AURA commands
    logger.info('Overwriting global application slash commands...');
    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );

    // 2. Register commands directly to all joined guilds for INSTANT (0-second) availability
    try {
      const guilds = await rest.get(Routes.userGuilds());
      logger.info(`Deploying instant slash commands to ${guilds.length} guilds...`);

      for (const guild of guilds) {
        try {
          await rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body: commands });
          logger.success(`✓ Instant slash commands active for: ${guild.name} (${guild.id})`);
        } catch (e) {
          logger.warn(`Could not deploy guild commands for ${guild.name}:`, e.message);
        }
      }
    } catch (err) {
      logger.warn('Could not inspect guilds for direct deployment:', err.message);
    }

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
