'use strict';

const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getLogConfig } = require('../utils/logConfig');

// Fallback channel ID for moderation logs (ban, kick)
const MOD_LOG_CHANNEL_ID = '1512013682002104340'; // mapped to moderation-logs/mute-logs

/**
 * Registers guildMemberUpdate, guildBanAdd, guildBanRemove, and guildMemberRemove
 * event listeners on the client for role-change and moderation logging.
 * @param {import('discord.js').Client} client
 */
function register(client) {
  // ── Role changes ──────────────────────────────────────────────────────────
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    const cfg = getLogConfig();
    if (!cfg.roleLog) return;
    const channel = newMember.guild.channels.cache.get(cfg.roleLog);
    if (!channel) return;

    if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
      const oldRoles     = oldMember.roles.cache.map(r => r.id);
      const newRoles     = newMember.roles.cache.map(r => r.id);
      const addedRoles   = newRoles.filter(r => !oldRoles.includes(r));
      const removedRoles = oldRoles.filter(r => !newRoles.includes(r));

      if (addedRoles.length > 0) {
        const embed = new EmbedBuilder()
          .setTitle('➕ Role Assigned')
          .setColor('#00ff66')
          .setThumbnail(newMember.user.displayAvatarURL({ forceStatic: true }))
          .addFields(
            { name: '👤 Member', value: `${newMember.user}\n\`${newMember.user.username}\``, inline: true },
            { name: '🛡️ Role Added', value: `<@&${addedRoles[0]}>`, inline: true },
            { name: '🕒 Occurred', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
          )
          .setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
      }
      if (removedRoles.length > 0) {
        const embed = new EmbedBuilder()
          .setTitle('➖ Role Revoked')
          .setColor('#ff3333')
          .setThumbnail(newMember.user.displayAvatarURL({ forceStatic: true }))
          .addFields(
            { name: '👤 Member', value: `${newMember.user}\n\`${newMember.user.username}\``, inline: true },
            { name: '🛡️ Role Removed', value: `<@&${removedRoles[0]}>`, inline: true },
            { name: '🕒 Occurred', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
          )
          .setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
      }
    }
  });

  // ── Ban added ─────────────────────────────────────────────────────────────
  client.on('guildBanAdd', async ban => {
    try {
      const modLogChannel = ban.guild.channels.cache.get(MOD_LOG_CHANNEL_ID);
      if (!modLogChannel) return;
      const embed = new EmbedBuilder()
        .setTitle('🔨 Member Banned')
        .setColor('#ff3333')
        .setThumbnail(ban.user.displayAvatarURL({ forceStatic: true }))
        .addFields(
          { name: '👤 Banned User', value: `${ban.user}\n\`${ban.user.username}\``, inline: true },
          { name: '📝 Reason', value: `\`${ban.reason || 'No reason provided'}\``, inline: true },
          { name: '🕒 Occurred', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
        )
        .setTimestamp();
      await modLogChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to log ban:', err);
    }
  });

  // ── Ban removed ───────────────────────────────────────────────────────────
  client.on('guildBanRemove', async ban => {
    try {
      const modLogChannel = ban.guild.channels.cache.get(MOD_LOG_CHANNEL_ID);
      if (!modLogChannel) return;
      const embed = new EmbedBuilder()
        .setTitle('🔓 Member Unbanned')
        .setColor('#00ff66')
        .setThumbnail(ban.user.displayAvatarURL({ forceStatic: true }))
        .addFields(
          { name: '👤 User', value: `${ban.user}\n\`${ban.user.username}\``, inline: true },
          { name: '🕒 Occurred', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
        )
        .setTimestamp();
      await modLogChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to log unban:', err);
    }
  });

  // ── Kick detection ────────────────────────────────────────────────────────
  client.on('guildMemberRemove', async member => {
    try {
      const modLogChannel = member.guild.channels.cache.get(MOD_LOG_CHANNEL_ID);
      if (!modLogChannel) return;

      // Wait briefly for the audit log entry to appear
      await new Promise(resolve => setTimeout(resolve, 1000));

      const fetchedLogs = await member.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberKick,
      }).catch(() => null);

      const kickLog = fetchedLogs?.entries.first();
      const now     = Date.now();

      if (kickLog && kickLog.target.id === member.id && (now - kickLog.createdTimestamp) < 5000) {
        const embed = new EmbedBuilder()
          .setTitle('👢 Member Kicked')
          .setColor('#ffaa00')
          .setThumbnail(member.user.displayAvatarURL({ forceStatic: true }))
          .addFields(
            { name: '👤 Kicked User', value: `${member.user}\n\`${member.user.username}\``, inline: true },
            { name: '👮 Executor', value: `${kickLog.executor}\n\`${kickLog.executor.username}\``, inline: true },
            { name: '📝 Reason', value: `\`${kickLog.reason || 'No reason provided'}\``, inline: true },
            { name: '🕒 Occurred', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: false }
          )
          .setTimestamp();
        await modLogChannel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error('Failed to log kick:', err);
    }
  });
}

module.exports = { register };
