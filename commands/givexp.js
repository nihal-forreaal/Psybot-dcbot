const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const levelsPath = path.join(__dirname, '..', 'levels.json');

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
      levelsGained,
      currentXP: levels[userId].xp
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
  name: 'givexp',
  description: 'Give XP to a user (admin only)',
  async execute(message, args) {
    const isAdminRole = message.member.roles.cache.has(process.env.ADMIN_ROLE_ID);
    const hasAdminPerm = message.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isAdminRole && !hasAdminPerm) {
      return message.reply('Only admins can use this command.');
    }

    if (!args[0]) {
      return message.reply('Please specify a user (mention or ID). Example: `!givexp @person 100` or `!givexp 1105072573580062790 100`');
    }

    // Try to get target user from mention first, then by ID
    let targetUser = message.mentions.users.first();
    let targetId = targetUser ? targetUser.id : args[0].replace(/[<@!>]/g, '');

    // Validate ID
    if (!/^\d+$/.test(targetId)) {
      return message.reply('Invalid user ID/mention provided.');
    }

    if (!targetUser) {
      targetUser = await message.client.users.fetch(targetId).catch(() => null);
    }

    if (!targetUser) {
      return message.reply('User not found.');
    }

    const xpAmount = parseInt(args[1], 10);
    if (isNaN(xpAmount) || xpAmount <= 0) {
      return message.reply('Please specify a valid positive amount of XP to give.');
    }

    const result = addXP(targetId, xpAmount);
    if (!result || result.currentXP === undefined) {
      return message.reply('Failed to give XP to user.');
    }

    const replyEmbed = new EmbedBuilder()
      .setTitle('🎁 XP Gifted!')
      .setDescription(`Successfully gave **${xpAmount} XP** to ${targetUser} (ID: \`${targetId}\`).`)
      .setColor('#57F287')
      .addFields({ name: 'Total XP', value: `${result.currentXP} XP` });

    await message.reply({ embeds: [replyEmbed] });

    const member = await message.guild.members.fetch(targetId).catch(() => null);
    if (member) {
      if (result.leveledUp) {
        // Sequentially announce every level gained and apply roles
        for (const lvl of result.levelsGained) {
          await giveLevelRole(member, lvl);

          const levelChannel = message.client.channels.cache.get(process.env.LEVEL_CHANNEL_ID);
          if (levelChannel) {
            const embed = new EmbedBuilder()
              .setTitle('🎉 Level Up!')
              .setDescription(`${targetUser} has reached Level ${lvl}!`)
              .addFields(
                { name: '✅ XP', value: `${result.currentXP} / ${lvl * 600 + 600}` },
                { name: '📊 Level', value: `${lvl}`, inline: true }
              )
              .setColor('#5865F2')
              .setThumbnail(targetUser.displayAvatarURL())
              .setFooter({ text: 'Keep grinding to reach the top!' });

            await levelChannel.send({ embeds: [embed] });
            // Small delay to ensure correct ordering in level channel
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } else {
        // Just make sure they have their current correct level role
        await giveLevelRole(member, result.newLevel);
      }
    }
  }
};
