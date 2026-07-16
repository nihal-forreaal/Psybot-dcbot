'use strict';

const { EmbedBuilder, ChannelType } = require('discord.js');
const https = require('https');

// In‑memory cache: { [guildId]: { totalMembers, bots, online, text, voice, categories, boostTier, boostCount, uptime } }
const statsCache = {};

/**
 * Collects statistics for a single guild.
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').Client} client
 * @returns {Promise<Object>} stats object
 */
async function collectStats(guild, client) {
  // Ensure full member list is cached
  await guild.members.fetch();
  const totalMembers = guild.memberCount;
  const bots = guild.members.cache.filter(m => m.user.bot).size;
  const online = guild.members.cache.filter(m => !m.user.bot && m.presence?.status && m.presence.status !== 'offline').size;

  const text = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
  const voice = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
  const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;

  const boostTier = guild.premiumTier;
  const boostCount = guild.premiumSubscriptionCount || 0;

  const uptimeMs = client.uptime || 0;
  const uptime = msToDHMS(uptimeMs);

  return { totalMembers, bots, online, text, voice, categories, boostTier, boostCount, uptime };
}

function msToDHMS(ms) {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

/**
 * Refreshes the cache for all guilds the bot is in.
 * @param {import('discord.js').Client} client
 */
async function refreshCache(client) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const data = await collectStats(guild, client);
      statsCache[guild.id] = data;

      // Optional Statbot.net forwarding – only if API token is set
      const token = process.env.STATBOT_API_TOKEN;
      if (token) {
        const payload = {
          server_id: guild.id,
          members: data.totalMembers,
          bots: data.bots,
          online: data.online,
          text_channels: data.text,
          voice_channels: data.voice,
          categories: data.categories,
          boost_tier: data.boostTier,
          boost_count: data.boostCount,
          uptime: data.uptime,
        };
        const req = https.request({
          hostname: 'api.statbot.net',
          path: `/v1/servers/${guild.id}/stats`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }, res => {
          if (res.statusCode !== 200) {
            console.warn(`[Stats] Statbot.net responded ${res.statusCode}`);
          }
        });
        req.on('error', err => console.error('[Stats] Failed to POST to Statbot.net:', err.message));
        req.write(JSON.stringify(payload));
        req.end();
      }
    } catch (err) {
      console.error(`[Stats] Error collecting stats for guild ${guild.id}:`, err.message);
    }
  }
}

/**
 * Generates an Embed with the cached stats for a guild.
 * @param {import('discord.js').Guild} guild
 * @returns {EmbedBuilder}
 */
function generateStatsEmbed(guild) {
  const data = statsCache[guild.id] || {};
  const embed = new EmbedBuilder()
    .setTitle('📊 Server Statistics')
    .setColor('#3498db')
    .setThumbnail(guild.iconURL({ extension: 'png', size: 256 }))
    .addFields(
      { name: 'Members', value: `${data.totalMembers ?? 'N/A'} (🟢 Online: ${data.online ?? 'N/A'}, 🤖 Bots: ${data.bots ?? 'N/A'})`, inline: false },
      { name: 'Channels', value: `Text: ${data.text ?? 'N/A'}\nVoice: ${data.voice ?? 'N/A'}\nCategories: ${data.categories ?? 'N/A'}`, inline: true },
      { name: 'Boost', value: `Tier: ${data.boostTier ?? 'N/A'}\nCount: ${data.boostCount ?? 'N/A'}`, inline: true },
      { name: 'Uptime', value: data.uptime ?? 'N/A', inline: false },
    )
    .setTimestamp();
  return embed;
}

module.exports = { refreshCache, generateStatsEmbed, statsCache };
