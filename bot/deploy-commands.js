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

    logger.info(`Started refreshing ${commands.length} application (/) commands.`);

    // Global deployment
    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );

    logger.success(`Successfully registered ${data.length} global application (/) commands.`);
  } catch (error) {
    logger.error('Error deploying commands:', error);
  }
})();
