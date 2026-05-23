const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const levelsUtil = require('../levelsUtil');

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

    const result = levelsUtil.addXP(targetId, xpAmount);
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
          await levelsUtil.giveLevelRole(member, lvl);

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
        await levelsUtil.giveLevelRole(member, result.newLevel);
      }
    }
  }
};
