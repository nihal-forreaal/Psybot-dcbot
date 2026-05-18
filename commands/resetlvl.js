const fs = require('fs');
const path = require('path');

const levelsPath = path.join(__dirname, '..', 'levels.json');

function readLevels() {
  try {
    const content = fs.readFileSync(levelsPath, 'utf8').trim();
    return content ? JSON.parse(content) : {};
  } catch (err) {
    console.error('Failed to read levels.json:', err.message);
    return {};
  }
}

function writeLevels(levels) {
  const tempPath = `${levelsPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(levels, null, 2));
  fs.renameSync(tempPath, levelsPath);
}

module.exports = {
  name: 'resetlvl',
  description: 'Reset a user level and XP (admin only)',
  async execute(message) {
    if (!message.member.roles.cache.has(process.env.ADMIN_ROLE_ID)) {
      return message.reply('Only admins can use this command.');
    }

    const target = message.mentions.users.first();
    if (!target) {
      return message.reply('Please mention a user. Example: `!resetlvl @person`');
    }

    const levels = readLevels();
    levels[target.id] = { xp: 0, level: 0 };
    writeLevels(levels);

    return message.reply(`Reset level and XP for ${target}.`);
  },
};
