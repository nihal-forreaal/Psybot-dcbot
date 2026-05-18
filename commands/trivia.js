const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const levelsPath = path.join(__dirname, '..', 'levels.json');
const activeGames = new Map();
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

const TRIVIA_QUESTIONS = [
  {
    question: "Which language is primarily used to build modern Discord bots like this one?",
    options: ["Python", "Java", "JavaScript", "C++"],
    correctIndex: 2,
    category: "💻 Technology"
  },
  {
    question: "What is the name of the main protagonist in 'The Legend of Zelda' series?",
    options: ["Zelda", "Link", "Ganon", "Luigi"],
    correctIndex: 1,
    category: "🎮 Gaming"
  },
  {
    question: "Which of the following is NOT a Hogwarts house in Harry Potter?",
    options: ["Gryffindor", "Hufflepuff", "Slytherin", "Ravenclaw", "Wampus"],
    correctIndex: 4,
    category: "🎬 Movies & Books"
  },
  {
    question: "Which company created the popular sandbox game 'Minecraft'?",
    options: ["Epic Games", "Mojang", "Valve", "Nintendo"],
    correctIndex: 1,
    category: "🎮 Gaming"
  },
  {
    question: "What does CPU stand for?",
    options: ["Computer Processing Unit", "Central Processor Utility", "Central Processing Unit", "Core Power Unit"],
    correctIndex: 2,
    category: "💻 Technology"
  },
  {
    question: "In the anime 'Naruto', what is Naruto's signature jutsu?",
    options: ["Chidori", "Rasengan", "Amaterasu", "Kotoamatsukami"],
    correctIndex: 1,
    category: "⛩️ Anime"
  },
  {
    question: "Which social platform was launched by Mark Zuckerberg in 2004?",
    options: ["Instagram", "Twitter", "Facebook", "TikTok"],
    correctIndex: 2,
    category: "💻 Technology"
  },
  {
    question: "In GTA V, who are the three playable main characters?",
    options: ["Michael, Trevor, Franklin", "Niko, Roman, CJ", "Tommy, Claude, Toni", "Arthur, John, Dutch"],
    correctIndex: 0,
    category: "🎮 Gaming"
  },
  {
    question: "What is the capital city of Japan?",
    options: ["Kyoto", "Osaka", "Tokyo", "Seoul"],
    correctIndex: 2,
    category: "🌍 General Knowledge"
  },
  {
    question: "How many bones are there in an adult human body?",
    options: ["106", "206", "306", "156"],
    correctIndex: 1,
    category: "🌍 General Knowledge"
  },
  {
    question: "Which planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Saturn"],
    correctIndex: 1,
    category: "🌍 General Knowledge"
  },
  {
    question: "What is the highest-grossing film of all time (unadjusted for inflation)?",
    options: ["Titanic", "Avengers: Endgame", "Avatar", "Star Wars: The Force Awakens"],
    correctIndex: 2,
    category: "🎬 Movies & Books"
  }
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

async function playTrivia(message, userId, streak = 0) {
  let session = activeGames.get(userId);
  if (!session) {
    session = { askedIndices: [] };
    activeGames.set(userId, session);
  }

  // Pick a random question that has not been asked in this session
  let availableIndices = [];
  for (let i = 0; i < TRIVIA_QUESTIONS.length; i++) {
    if (!session.askedIndices.includes(i)) {
      availableIndices.push(i);
    }
  }

  // If all questions have been asked, reset history to repeat them
  if (availableIndices.length === 0) {
    session.askedIndices = [];
    availableIndices = TRIVIA_QUESTIONS.map((_, i) => i);
  }

  const randomIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
  session.askedIndices.push(randomIdx);

  const qData = TRIVIA_QUESTIONS[randomIdx];
  const labels = ['A', 'B', 'C', 'D', 'E'];

  // Create Options Buttons
  const optionsRow = new ActionRowBuilder();
  qData.options.forEach((opt, idx) => {
    optionsRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`trivia_${idx}`)
        .setLabel(`${labels[idx]}. ${opt.substring(0, 30)}`)
        .setStyle(ButtonStyle.Secondary)
    );
  });

  const questionEmbed = new EmbedBuilder()
    .setTitle('🧠 Trivia Time!')
    .setAuthor({ name: qData.category })
    .setDescription(`**${qData.question}**\n\n` + qData.options.map((opt, i) => `**${labels[i]}.** ${opt}`).join('\n'))
    .setColor('#5865F2')
    .setFooter({ text: '⏱️ 15s | Correct = 50 XP (3-4 Streak: 1.2x XP | 5+ Streak: 1.5x XP)' });

  const gameMessage = await message.channel.send({ embeds: [questionEmbed], components: [optionsRow] });

  // Collect button click from the same user
  const filter = i => i.user.id === userId && i.customId.startsWith('trivia_');
  const collector = gameMessage.createMessageComponentCollector({ filter, time: 15000 });

  let answered = false;

  collector.on('collect', async interaction => {
    answered = true;
    const clickedIdx = parseInt(interaction.customId.split('_')[1], 10);
    const isCorrect = clickedIdx === qData.correctIndex;

    // Build disabled options row with coloring
    const finalRow = new ActionRowBuilder();
    qData.options.forEach((opt, idx) => {
      let style = ButtonStyle.Secondary;
      if (idx === qData.correctIndex) {
        style = ButtonStyle.Success; // Green for correct
      } else if (idx === clickedIdx && !isCorrect) {
        style = ButtonStyle.Danger; // Red for clicked incorrect
      }
      finalRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`trivia_disabled_${idx}`)
          .setLabel(`${labels[idx]}. ${opt.substring(0, 30)}`)
          .setStyle(style)
          .setDisabled(true)
      );
    });

    const nextRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('trivia_next')
        .setLabel('Next Question ➡️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('trivia_stop')
        .setLabel('Stop Game 🛑')
        .setStyle(ButtonStyle.Danger)
    );

    let resultEmbed;
    let nextStreak = 0;
    if (isCorrect) {
      nextStreak = streak + 1;
      const baseXP = 50;
      let multiplier = 1.0;
      if (nextStreak >= 5) {
        multiplier = 1.5;
      } else if (nextStreak >= 3) {
        multiplier = 1.2;
      }
      const xpReward = Math.round(baseXP * multiplier);
      const { leveledUp, newLevel, levelsGained } = addXP(userId, xpReward);

      let streakText = '';
      if (nextStreak >= 5) {
        streakText = `🔥 **Streak:** ${nextStreak} in a row! (**1.5x Multiplier** applied! 🚀)\n\n`;
      } else if (nextStreak >= 3) {
        streakText = `🔥 **Streak:** ${nextStreak} in a row! (**1.2x Multiplier** applied! ✨)\n\n`;
      } else if (nextStreak > 1) {
        streakText = `🔥 **Streak:** ${nextStreak} in a row!\n\n`;
      }

      resultEmbed = new EmbedBuilder()
        .setTitle('🎉 Correct Answer!')
        .setDescription(
          `Awesome job <@${userId}>! **${qData.options[qData.correctIndex]}** is the correct answer!\n\n` +
          streakText +
          `🎁 **Reward:** +${xpReward} XP!`
        )
        .setColor('#57F287');

      if (leveledUp) {
        resultEmbed.addFields({ name: '🌟 Level Up!', value: `You reached **Level ${newLevel}**! 🚀` });
        if (message.member) {
          for (const lvl of (levelsGained || [])) {
            await giveLevelRole(message.member, lvl);
          }
        }
      }
    } else {
      nextStreak = 0;
      resultEmbed = new EmbedBuilder()
        .setTitle('❌ Incorrect Answer!')
        .setDescription(
          `Oops! You chose **${qData.options[clickedIdx]}**.\n\n` +
          `✅ The correct answer was **${labels[qData.correctIndex]}. ${qData.options[qData.correctIndex]}**.\n\n` +
          `💔 Streak reset to 0.`
        )
        .setColor('#E74C3C');
    }

    // Update old message with disabled choices and show the Next Question button
    await interaction.update({ embeds: [resultEmbed], components: [finalRow, nextRow] });
    collector.stop('answered');

    // Create a new collector for the "Next Question" button
    setupNextQuestionCollector(gameMessage, userId, nextRow, finalRow, nextStreak);
  });

  collector.on('end', async (collected, reason) => {
    if (!answered) {
      const timeoutRow = new ActionRowBuilder();
      qData.options.forEach((opt, idx) => {
        const style = idx === qData.correctIndex ? ButtonStyle.Success : ButtonStyle.Secondary;
        timeoutRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`trivia_timeout_${idx}`)
            .setLabel(`${labels[idx]}. ${opt.substring(0, 30)}`)
            .setStyle(style)
            .setDisabled(true)
        );
      });

      const nextRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('trivia_next')
          .setLabel('Next Question ➡️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('trivia_stop')
          .setLabel('Stop Game 🛑')
          .setStyle(ButtonStyle.Danger)
      );

      const timeoutEmbed = new EmbedBuilder()
        .setTitle('⏰ Time is Up!')
        .setDescription(`You didn't answer in time. The correct answer was **${labels[qData.correctIndex]}. ${qData.options[qData.correctIndex]}**.\n\n💔 Streak reset to 0.`)
        .setColor('#95A5A6');

      try {
        await gameMessage.edit({ embeds: [timeoutEmbed], components: [timeoutRow, nextRow] });
        setupNextQuestionCollector(gameMessage, userId, nextRow, timeoutRow, 0);
      } catch (err) {
        console.error('Failed to edit trivia timeout message:', err.message);
        activeGames.delete(userId);
      }
    }
  });
}

function setupNextQuestionCollector(gameMessage, userId, nextRow, optionRow, streak) {
  const nextFilter = i => i.user.id === userId && (i.customId === 'trivia_next' || i.customId === 'trivia_stop');
  const nextCollector = gameMessage.createMessageComponentCollector({ filter: nextFilter, time: 30000 });

  nextCollector.on('collect', async nextInteraction => {
    nextCollector.stop('clicked');

    if (nextInteraction.customId === 'trivia_stop') {
      activeGames.delete(userId);

      const stopEmbed = new EmbedBuilder()
        .setTitle('🏁 Trivia Game Stopped')
        .setDescription(`You have stopped the trivia game.\n\n🔥 **Final Streak:** ${streak} Correct answers!`)
        .setColor('#E74C3C');

      try {
        await nextInteraction.update({ embeds: [stopEmbed], components: [optionRow] });
      } catch (err) {
        console.error('Failed to update stop message:', err.message);
      }
      return;
    }

    // Disable both the "Next Question" and "Stop Game" buttons so they can't double-click
    const disabledNextRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('trivia_next_disabled')
        .setLabel('Next Question ➡️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('trivia_stop_disabled')
        .setLabel('Stop Game 🛑')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true)
    );

    try {
      await nextInteraction.update({ components: [optionRow, disabledNextRow] });
    } catch (err) {
      console.error('Failed to disable next button:', err.message);
    }

    // Play next round!
    await playTrivia(gameMessage, userId, streak);
  });

  nextCollector.on('end', async (collected, reason) => {
    // If the next button collector times out without being clicked, free up the user session
    if (reason !== 'clicked') {
      activeGames.delete(userId);

      // Clean up the message by removing the "Next Question" button row
      try {
        await gameMessage.edit({ components: [optionRow] });
      } catch (err) {
        console.error('Failed to clean up next button on timeout:', err.message);
      }
    }
  });
}

module.exports = {
  name: 'trivia',
  description: 'Answer a rapid-fire trivia question to win XP!',
  async execute(message) {
    // Restrict command to the games channel
    if (message.channel.id !== GAMES_CHANNEL_ID) {
      return message.reply(`❌ Games can only be played in <#${GAMES_CHANNEL_ID}>!`);
    }

    const userId = message.author.id;

    if (activeGames.has(userId)) {
      return message.reply('❌ Finish your current game before starting a new one!');
    }

    activeGames.set(userId, { askedIndices: [] });
    await playTrivia(message, userId);
  }
};
