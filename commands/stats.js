'use strict';

const { getStats, getRank, getTopChannels, getDailyMsgChart, getDailyVcChart } = require('../modules/userStats');
const { generateStatsCard } = require('../modules/statsCard');

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

module.exports = {
  name: 'stats',
  aliases: ['stat', 'userstats'],
  description: 'Show Statbot-style stats card for a user. Usage: ,stats [@user]',

  async execute(message, args) {
    // Resolve target user
    let target = message.mentions.users.first();
    if (!target && args[0]) {
      // Try fetch by ID
      target = await message.client.users.fetch(args[0]).catch(() => null);
    }
    if (!target) target = message.author;

    // Fetch member for guild-specific info
    const member = await message.guild.members.fetch(target.id).catch(() => null);

    // Ensure member is cached for proper data
    const guildId  = message.guild.id;
    const userId   = target.id;

    // Gather all stats
    const { msgCounts, vcHours }  = getStats(guildId, userId);
    const { msgRank, vcRank }     = getRank(guildId, userId);
    const { topMsg, topVc }       = getTopChannels(guildId, userId);
    const msgChart                = getDailyMsgChart(guildId, userId);
    const vcChart                 = getDailyVcChart(guildId, userId);

    // Resolve channel names
    async function resolveChannelName(channelId) {
      const ch = message.guild.channels.cache.get(channelId)
        || await message.guild.channels.fetch(channelId).catch(() => null);
      return ch ? ch.name : channelId;
    }

    const topMsgResolved = await Promise.all(
      topMsg.map(async c => ({ ...c, channelName: await resolveChannelName(c.channelId) }))
    );
    const topVcResolved = await Promise.all(
      topVc.map(async c => ({ ...c, channelName: await resolveChannelName(c.channelId) }))
    );

    // Build card options
    const avatarUrl = target.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
    const createdAt = formatDate(target.createdAt);
    const joinedAt  = member ? formatDate(member.joinedAt) : 'Unknown';

    const buffer = await generateStatsCard({
      username:      target.username,
      discriminator: target.discriminator || '0',
      guildName:     message.guild.name,
      avatarUrl,
      createdAt,
      joinedAt,
      msgRank,
      vcRank,
      msgCounts,
      vcHours,
      topMsg:    topMsgResolved,
      topVc:     topVcResolved,
      msgChart,
      vcChart,
    });

    await message.reply({
      files: [{ attachment: buffer, name: `stats-${target.username}.png` }],
    });
  },
};
