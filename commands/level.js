const { EmbedBuilder } = require('discord.js');
const levelsUtil = require('../levelsUtil');

module.exports = {
  name: 'lvl',
  description: 'Check your current level and XP',
  async execute(message) {
    const userId = message.author.id;
    const userLevel = levelsUtil.getUserLevel(userId);

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
