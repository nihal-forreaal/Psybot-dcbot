const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

function readLevels() {
  try {
    const content = fs.readFileSync(path.join(__dirname, '..', 'levels.json'), 'utf8').trim();
    return content ? JSON.parse(content) : {};
  } catch (err) {
    console.error('Failed to read levels.json:', err.message);
    return {};
  }
}

module.exports = {
  name: 'lvl',
  description: 'Check your current level and XP',
  async execute(message) {
    const levels = readLevels();
    const userId = message.author.id;
    const userLevel = levels[userId] || { xp: 0, level: 0 };

    const xpNeeded = userLevel.level * 600 + 600;
    const xpProgress = (userLevel.xp / xpNeeded) * 100;

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${message.author.username}'s Level`)
      .setDescription(`Level: **${userLevel.level}**`)
      .addFields(
        { name: '✅ XP', value: `${userLevel.xp} / ${xpNeeded}`, inline: true },
        { name: '📈 Progress', value: `${xpProgress.toFixed(1)}%`, inline: true }
      )
      .setColor('#5865F2')
      .setThumbnail(message.author.displayAvatarURL())
      .setFooter({ text: 'Gain XP by sending messages and voice time!' });

    message.reply({ embeds: [embed] });
  }
};
