const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const levelsPath = path.join(__dirname, '..', 'levels.json');
const activeGames = new Set();
const GAMES_CHANNEL_ID = '1506009762901524661';

const LEVEL_ROLE_REWARDS = [
  { level: 1, name: 'Nobby 1' },
  { level: 2, name: 'Normie 2' },
  { level: 5, name: 'Rookie 5' },
  { level: 10, name: 'Grinder 10' },
  { level: 15, name: 'Sweaty 15' },
  { level: 20, name: 'Pro 20' },
  { level: 30, name: 'Elite 30' },
  { level: 35, name: 'Legend 35' },
  { level: 40, name: 'Mythic 40' },
  { level: 50, name: 'Godmode 50' },
];

function addXP(userId, xpAmount) {
  try {
    let levels = {};
    if (fs.existsSync(levelsPath)) {
      const content = fs.readFileSync(levelsPath, 'utf8').trim();
      levels = content ? JSON.parse(content) : {};
    }
    if (!levels[userId]) {
      levels[userId] = { xp: 0, level: 0 };
    }
    levels[userId].xp += xpAmount;

    let levelsGained = [];
    let initialLevel = levels[userId].level;

    while (true) {
      const xpNeeded = levels[userId].level * 600 + 600;
      if (levels[userId].xp >= xpNeeded) {
        levels[userId].level += 1;
        levelsGained.push(levels[userId].level);
      } else {
        break;
      }
    }

    fs.writeFileSync(levelsPath, JSON.stringify(levels, null, 2), 'utf8');
    return {
      leveledUp: levelsGained.length > 0,
      newLevel: levels[userId].level,
      levelsGained
    };
  } catch (err) {
    console.error('Failed to update levels.json:', err);
    return { leveledUp: false };
  }
}

async function giveLevelRole(member, level) {
  const reward = LEVEL_ROLE_REWARDS.find(r => r.level === level);
  if (!reward) return;

  try {
    const roles = await member.guild.roles.fetch();
    const role = roles.find(r => r.name.toLowerCase() === reward.name.toLowerCase());
    if (role) {
      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role);
      }

      // Remove all OTHER level roles from the member
      for (const r of LEVEL_ROLE_REWARDS) {
        if (r.level !== level) {
          const otherRole = roles.find(o => o.name.toLowerCase() === r.name.toLowerCase());
          if (otherRole && member.roles.cache.has(otherRole.id)) {
            await member.roles.remove(otherRole).catch(() => null);
          }
        }
      }
    }
  } catch (err) {
    console.error(`Failed to manage role for ${reward.name} on level up:`, err.message);
  }
}

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
          const result = addXP(userId, xpReward);
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
              await giveLevelRole(message.member, lvl);
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
