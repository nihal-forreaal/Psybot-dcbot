const { EmbedBuilder } = require('discord.js');
const levelsUtil = require('../levelsUtil');

module.exports = {
  name: 'leaderboard',
  description: 'Show top 10 users by level',
  async execute(message) {
    const levels = levelsUtil.getLevels();

    // Sort by level then by XP
    const sorted = Object.entries(levels)
      .sort((a, b) => {
        if (b[1].level !== a[1].level) {
          return b[1].level - a[1].level;
        }
        return b[1].xp - a[1].xp;
      })
      .slice(0, 10);

    if (sorted.length === 0) {
      return message.reply('❌ No users have leveled up yet!');
    }

    let leaderboardText = '';
    for (let i = 0; i < sorted.length; i++) {
      const [userId, userLevel] = sorted[i];
      try {
        const user = await message.client.users.fetch(userId);
        leaderboardText += `**${i + 1}.** ${user.tag} - Level **${userLevel.level}** (${userLevel.xp} XP)\n`;
      } catch (err) {
        leaderboardText += `**${i + 1}.** Unknown User - Level **${userLevel.level}** (${userLevel.xp} XP)\n`;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('🏆 Level Leaderboard')
      .setDescription(leaderboardText)
      .setColor('#FFD700')
      .setFooter({ text: 'Top 10 Users' });

    message.reply({ embeds: [embed] });
  }
};
