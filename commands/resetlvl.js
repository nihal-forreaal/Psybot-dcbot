const levelsUtil = require('../levelsUtil');

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

    levelsUtil.resetLevel(target.id);

    return message.reply(`Reset level and XP for ${target}.`);
  },
};
