const fs = require('fs');
const path = require('path');
const logger = require('../../shared/logger');

module.exports = (client) => {
  const eventsPath = path.join(__dirname, '../events');
  if (!fs.existsSync(eventsPath)) {
    fs.mkdirSync(eventsPath, { recursive: true });
    return;
  }

  const categories = fs.readdirSync(eventsPath);
  let eventCount = 0;

  for (const item of categories) {
    const itemPath = path.join(eventsPath, item);

    if (fs.statSync(itemPath).isDirectory()) {
      const eventFiles = fs.readdirSync(itemPath).filter(file => file.endsWith('.js'));
      for (const file of eventFiles) {
        registerEvent(client, path.join(itemPath, file));
        eventCount++;
      }
    } else if (item.endsWith('.js')) {
      registerEvent(client, itemPath);
      eventCount++;
    }
  }

  logger.bot(`Registered ${eventCount} Discord event listeners.`);
};

function registerEvent(client, filePath) {
  try {
    const event = require(filePath);
    if (!event.name || !event.execute) return;

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  } catch (err) {
    logger.error(`Failed to register event at ${filePath}:`, err.message);
  }
}
