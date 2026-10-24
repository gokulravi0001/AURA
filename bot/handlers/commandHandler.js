const fs = require('fs');
const path = require('path');
const logger = require('../../shared/logger');

module.exports = (client) => {
  const commandsPath = path.join(__dirname, '../commands');
  if (!fs.existsSync(commandsPath)) {
    fs.mkdirSync(commandsPath, { recursive: true });
    return;
  }

  const categories = fs.readdirSync(commandsPath);
  let slashCount = 0;
  let prefixCount = 0;

  for (const category of categories) {
    const categoryPath = path.join(commandsPath, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    const commandFiles = fs.readdirSync(categoryPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(categoryPath, file);
      try {
        const command = require(filePath);

        // Attach category metadata
        command.category = category;

        // Register Slash Command
        if (command.data && command.data.name) {
          client.commands.set(command.data.name, command);
          slashCount++;
        }

        // Register Prefix Command (+)
        const prefixName = command.name || (command.data && command.data.name);
        if (prefixName && command.executePrefix) {
          client.prefixCommands.set(prefixName.toLowerCase(), command);
          prefixCount++;

          if (Array.isArray(command.aliases)) {
            for (const alias of command.aliases) {
              client.aliases.set(alias.toLowerCase(), prefixName.toLowerCase());
            }
          }
        }
      } catch (err) {
        logger.error(`Failed to load command at ${filePath}:`, err.message);
      }
    }
  }

  logger.bot(`Loaded ${slashCount} slash commands and ${prefixCount} prefix (+) commands.`);
};
