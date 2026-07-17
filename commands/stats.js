'use strict';

const { EmbedBuilder } = require('discord.js');
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
      target = await message.client.users.fetch(args[0]).catch(() => null);
    }
    if (!target) target = message.author;

    const member  = await message.guild.members.fetch(target.id).catch(() => null);
    const guildId = message.guild.id;
    const userId  = target.id;

    // Gather stats
    const { msgCounts, vcHours } = getStats(guildId, userId);
    const { msgRank, vcRank }    = getRank(guildId, userId);
    const { topMsg, topVc }      = getTopChannels(guildId, userId);
    const msgChart               = getDailyMsgChart(guildId, userId);
    const vcChart                = getDailyVcChart(guildId, userId);

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

    const avatarUrl = target.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
    const createdAt = formatDate(target.createdAt);
    const joinedAt  = member ? formatDate(member.joinedAt) : 'Unknown';

    // Try canvas image first
    let buffer = null;
    try {
      buffer = await generateStatsCard({
        username: target.username,
        discriminator: target.discriminator || '0',
        guildName: message.guild.name,
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
    } catch (err) {
      console.error('[Stats] Canvas generation failed, using embed fallback:', err.message);
    }

    // Send image if available, otherwise use rich embed fallback
    if (buffer) {
      return message.reply({
        files: [{ attachment: buffer, name: `stats-${target.username}.png` }],
      });
    }

    // ── Embed fallback ────────────────────────────────────────────────────────
    const topChannelLines = [
      ...topMsgResolved.map(c => `# ${c.channelName} — **${c.count}** msgs`),
      ...topVcResolved.map(c => `🔊 ${c.channelName} — **${c.hours}h**`),
    ].slice(0, 4).join('\n') || '*No data yet*';

    const embed = new EmbedBuilder()
      .setColor('#e94560')
      .setAuthor({ name: `${target.username} — ${message.guild.name}`, iconURL: avatarUrl })
      .setThumbnail(avatarUrl)
      .addFields(
        { name: '📅 Account / Joined',  value: `Created: ${createdAt}\nJoined: ${joinedAt}`, inline: true },
        { name: '🏆 Server Ranks',       value: `Message: **#${msgRank}**\nVoice: **#${vcRank}**`, inline: true },
        { name: '\u200B', value: '\u200B', inline: true },
        { name: '# Messages (1d/7d/14d)', value: `1d: **${msgCounts[1]}** · 7d: **${msgCounts[7]}** · 14d: **${msgCounts[14]}**`, inline: false },
        { name: '🔊 Voice Hours (1d/7d/14d)', value: `1d: **${vcHours[1]}h** · 7d: **${vcHours[7]}h** · 14d: **${vcHours[14]}h**`, inline: false },
        { name: '📊 Top Channels & Apps', value: topChannelLines, inline: false },
      )
      .setFooter({ text: 'Server Lookback: Last 14 days • Timezone: UTC • ⚡ Powered by Psybot' })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
