const { EmbedBuilder } = require('discord.js');
const levelsUtil = require('../levelsUtil');

const activeGames = new Set();
const GAMES_CHANNEL_ID = '1506009762901524661';

// Leveling helpers removed. Using levelsUtil.

module.exports = {
  name: 'guess',
  description: 'Play a number guessing game (1-100) and win XP!',
  async execute(message) {
    // Restrict command to the games channel
    if (message.channel.id !== GAMES_CHANNEL_ID) {
      return message.reply(`❌ Games can only be played in <#${GAMES_CHANNEL_ID}>!`);
    }

    const userId = message.author.id;

    if (activeGames.has(userId)) {
      return message.reply('❌ You already have an active game! Type `cancel` to end it before starting a new one.');
    }

    // Start a new game
    activeGames.add(userId);
    const secretNumber = Math.floor(Math.random() * 100) + 1;
    let attempts = 0;

    const startEmbed = new EmbedBuilder()
      .setTitle('🔢 Number Guessing Game')
      .setDescription(
        `I have chosen a secret number between **1 and 100**.\n` +
        `Type your guess in the chat to start!\n\n` +
        `🎁 **XP Rewards (Scaled by attempts):**\n` +
        `• 1 attempt: **100 XP** 🍀\n` +
        `• 2 attempts: **80 XP**\n` +
        `• 3 attempts: **60 XP**\n` +
        `• 4 attempts: **50 XP**\n` +
        `• 5 attempts: **40 XP**\n` +
        `• 6 attempts: **30 XP**\n` +
        `• 7 attempts: **20 XP**\n` +
        `• 8 attempts: **15 XP**\n` +
        `• 9 attempts: **10 XP**\n` +
        `• 10 attempts: **5 XP**\n` +
        `• 11+ attempts: **0 XP** (No reward 😢)\n\n` +
        `*Type \`cancel\` at any time to end the game.*`
      )
      .setColor('#5865F2')
      .setFooter({ text: 'You have 60 seconds for each guess!' });

    const gameMessage = await message.channel.send({ embeds: [startEmbed] });

    // Listen for replies from the same user in the same channel
    const filter = m => m.author.id === userId && m.channel.id === GAMES_CHANNEL_ID;
    const collector = message.channel.createMessageCollector({ filter, idle: 60000 });

    collector.on('collect', async m => {
      const content = m.content.trim().toLowerCase();

      // Cancel game
      if (content === 'cancel' || content === 'stop' || content === 'quit') {
        collector.stop('cancelled');
        try { await m.react('👋'); } catch {}
        return;
      }

      const guess = parseInt(content, 10);
      if (isNaN(guess) || guess < 1 || guess > 100) {
        const warningEmbed = new EmbedBuilder()
          .setDescription('⚠️ Please enter a valid number between **1 and 100**.')
          .setColor('#E74C3C');
        await m.reply({ embeds: [warningEmbed] });
        return;
      }

      attempts++;

      if (guess === secretNumber) {
        collector.stop('won');
        
        // Dynamic XP Reward based on attempts (more than 10 attempts = no reward)
        let xpReward = 0;
        if (attempts === 1) {
          xpReward = 100;
        } else if (attempts === 2) {
          xpReward = 80;
        } else if (attempts === 3) {
          xpReward = 60;
        } else if (attempts === 4) {
          xpReward = 50;
        } else if (attempts === 5) {
          xpReward = 40;
        } else if (attempts === 6) {
          xpReward = 30;
        } else if (attempts === 7) {
          xpReward = 20;
        } else if (attempts === 8) {
          xpReward = 15;
        } else if (attempts === 9) {
          xpReward = 10;
        } else if (attempts === 10) {
          xpReward = 5;
        } else {
          xpReward = 0;
        }

        let leveledUp = false;
        let levelsGained = [];
        let newLevel = 0;
        if (xpReward > 0) {
          const result = levelsUtil.addXP(userId, xpReward);
          leveledUp = result.leveledUp;
          levelsGained = result.levelsGained || [];
          newLevel = result.newLevel;
        }

        const winEmbed = new EmbedBuilder()
          .setTitle('🎉 You Won!')
          .setDescription(
            `Congratulations ${message.author}! You guessed the secret number **${secretNumber}** correctly!\n\n` +
            `📊 **Attempts:** ${attempts}\n` +
            `🎁 **Reward:** ${xpReward > 0 ? `+${xpReward} XP!` : 'No XP reward (took more than 10 attempts) 😢'}`
          )
          .setColor('#57F287')
          .setThumbnail(message.author.displayAvatarURL());

        if (leveledUp) {
          winEmbed.addFields({ name: '🌟 Level Up!', value: `You reached **Level ${newLevel}**! 🚀` });
          if (message.member) {
            for (const lvl of levelsGained) {
              await levelsUtil.giveLevelRole(message.member, lvl);
            }
          }
        }

        await m.reply({ embeds: [winEmbed] });
      } else if (guess > secretNumber) {
        const highEmbed = new EmbedBuilder()
          .setDescription(`📉 **Lower** ⬇️`)
          .setColor('#F1C40F')
          .setFooter({ text: `Attempts: ${attempts}` });
        await m.reply({ embeds: [highEmbed] });
      } else {
        const lowEmbed = new EmbedBuilder()
          .setDescription(`📈 **Higher** ⬆️`)
          .setColor('#F1C40F')
          .setFooter({ text: `Attempts: ${attempts}` });
        await m.reply({ embeds: [lowEmbed] });
      }
    });

    collector.on('end', (collected, reason) => {
      activeGames.delete(userId);

      if (reason === 'idle') {
        const timeoutEmbed = new EmbedBuilder()
          .setTitle('⏰ Game Over')
          .setDescription(`The game timed out due to 60 seconds of inactivity. The secret number was **${secretNumber}**.`)
          .setColor('#95A5A6');
        message.channel.send({ content: `<@${userId}>`, embeds: [timeoutEmbed] });
      } else if (reason === 'cancelled') {
        const cancelEmbed = new EmbedBuilder()
          .setTitle('🛑 Game Cancelled')
          .setDescription(`You ended the game. The secret number was **${secretNumber}**.`)
          .setColor('#E74C3C');
        message.channel.send({ content: `<@${userId}>`, embeds: [cancelEmbed] });
      }
    });
  }
};
