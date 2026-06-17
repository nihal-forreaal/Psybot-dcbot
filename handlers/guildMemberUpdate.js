'use strict';

const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getLogConfig } = require('../utils/logConfig');

// Fallback channel ID for moderation logs (ban, kick)
const MOD_LOG_CHANNEL_ID = '1505909671918043258';

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
        const embed = new EmbedBuilder().setTitle('➕ Role Added').setColor('#2ecc71')
          .setDescription(`**User:** ${newMember.user}\n**Role:** <@&${addedRoles[0]}>`).setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
      }
      if (removedRoles.length > 0) {
        const embed = new EmbedBuilder().setTitle('➖ Role Removed').setColor('#e74c3c')
          .setDescription(`**User:** ${newMember.user}\n**Role:** <@&${removedRoles[0]}>`).setTimestamp();
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
        .setTitle('🔨 User Banned')
        .setColor('#e74c3c')
        .setDescription(
          `**User:** ${ban.user} ( @${ban.user.username} )\n` +
          `**Reason:** ${ban.reason || 'No reason provided'}\n` +
          `**Time:** <t:${Math.floor(Date.now() / 1000)}:R>`
        )
        .setThumbnail(ban.user.displayAvatarURL({ forceStatic: true }))
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
        .setTitle('🔓 User Unbanned')
        .setColor('#2ecc71')
        .setDescription(
          `**User:** ${ban.user} ( @${ban.user.username} )\n` +
          `**Time:** <t:${Math.floor(Date.now() / 1000)}:R>`
        )
        .setThumbnail(ban.user.displayAvatarURL({ forceStatic: true }))
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
          .setTitle('👢 User Kicked')
          .setColor('#e67e22')
          .setDescription(
            `**User:** ${member.user} ( @${member.user.username} )\n` +
            `**Kicked By:** ${kickLog.executor} ( @${kickLog.executor.username} )\n` +
            `**Reason:** ${kickLog.reason || 'No reason provided'}\n` +
            `**Time:** <t:${Math.floor(Date.now() / 1000)}:R>`
          )
          .setThumbnail(member.user.displayAvatarURL({ forceStatic: true }))
          .setTimestamp();
        await modLogChannel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error('Failed to log kick:', err);
    }
  });
}

module.exports = { register };
