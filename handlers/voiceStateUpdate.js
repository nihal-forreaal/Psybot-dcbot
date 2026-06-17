'use strict';

const {
  ChannelType, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
} = require('discord.js');
const { getLogConfig } = require('../utils/logConfig');

/**
 * Shared in-memory Map for tracking temporary VCs and voice join times.
 * Exported so that other modules can access it if needed.
 * Keys:
 *   - `"voice_<userId>"` → { joinTime: number }    (voice XP tracking)
 *   - `"<userId>"`       → { vcId: string, createdAt: number }  (temp VC)
 */
const tempVCs = new Map();

/**
 * Registers voiceStateUpdate on the client.
 * Handles:
 *   - Mute/deafen state logging
 *   - Voice join / leave / move logging
 *   - Custom welcome message when someone joins a temp VC
 *   - Auto-create temp VC when joining the designated "create" channel
 *   - Auto-delete temp VC when the owner leaves or switches
 * @param {import('discord.js').Client} client
 */
function register(client) {
  client.on('voiceStateUpdate', async (oldState, newState) => {
    const createVCChannelId = process.env.CREATE_VC_CHANNEL_ID;
    const vcCategoryId      = process.env.VC_CATEGORY_ID;

    // ── Mute / Deafen state logger ─────────────────────────────────────────
    try {
      const cfg = getLogConfig();
      const modLogChannelId = cfg.muteLog || '1505909671918043258';
      const modLogChannel   = newState.guild.channels.cache.get(modLogChannelId);

      if (modLogChannel) {
        const embed = new EmbedBuilder().setTimestamp();
        let action = null;
        let color  = '#f1c40f';

        if      (!oldState.serverMute && newState.serverMute)  { action = '🎙️ **Server Muted**';      color = '#e74c3c'; }
        else if (oldState.serverMute  && !newState.serverMute) { action = '🎙️ **Server Unmuted**';    color = '#2ecc71'; }
        else if (!oldState.serverDeaf && newState.serverDeaf)  { action = '🎧 **Server Deafened**';   color = '#e74c3c'; }
        else if (oldState.serverDeaf  && !newState.serverDeaf) { action = '🎧 **Server Undeafened**'; color = '#2ecc71'; }
        else if (!oldState.selfMute   && newState.selfMute)    { action = '🎙️ **Muted (Self)**';      color = '#e67e22'; }
        else if (oldState.selfMute    && !newState.selfMute)   { action = '🎙️ **Unmuted (Self)**';    color = '#2ecc71'; }
        else if (!oldState.selfDeaf   && newState.selfDeaf)    { action = '🎧 **Deafened (Self)**';   color = '#e67e22'; }
        else if (oldState.selfDeaf    && !newState.selfDeaf)   { action = '🎧 **Undeafened (Self)**'; color = '#2ecc71'; }

        if (action) {
          const channelMention = newState.channel
            ? `<#${newState.channel.id}> ( \`${newState.channel.name}\` )`
            : '`Not in a voice channel`';
          embed.setColor(color).setDescription(
            `${action}\n\n` +
            `**User:** ${newState.member.user} ( @${newState.member.user.username} )\n` +
            `**Channel:** ${channelMention}\n` +
            `**Time:** <t:${Math.floor(Date.now() / 1000)}:R>`
          );
          await modLogChannel.send({ embeds: [embed] });
        }
      }
    } catch (err) {
      console.error('Failed to send voice state moderation log:', err);
    }

    // ── User joined or moved to a channel ────────────────────────────────────
    if (newState.channel && oldState.channelId !== newState.channelId) {
      const userId = newState.member.user.id;

      // Voice XP join tracking
      if (!tempVCs.has(`voice_${userId}`)) {
        tempVCs.set(`voice_${userId}`, { joinTime: Date.now() });
      }

      // Voice join / move logger
      try {
        const cfgV = getLogConfig();
        const voiceLogChannel = newState.guild.channels.cache.get(cfgV.voiceLog || '1505907978992353280');
        if (voiceLogChannel) {
          const embed = new EmbedBuilder().setTimestamp();
          if (!oldState.channelId) {
            embed.setColor('#2ecc71').setDescription(
              `📥 **Voice Join**\n\n` +
              `**User:** ${newState.member.user} ( @${newState.member.user.username} )\n` +
              `**Channel:** <#${newState.channel.id}> ( \`${newState.channel.name}\` )\n` +
              `**Time:** <t:${Math.floor(Date.now() / 1000)}:R>`
            );
          } else {
            embed.setColor('#3498db').setDescription(
              `🔀 **Voice Move**\n\n` +
              `**User:** ${newState.member.user} ( @${newState.member.user.username} )\n` +
              `**Old Channel:** <#${oldState.channelId}>\n` +
              `**New Channel:** <#${newState.channelId}>\n` +
              `**Time:** <t:${Math.floor(Date.now() / 1000)}:R>`
            );
          }
          await voiceLogChannel.send({ embeds: [embed] });
        }
      } catch (err) {
        console.error('Failed to send voice channel join log:', err);
      }

      // Welcome message when joining another user's temp VC
      if (createVCChannelId && newState.channel.id !== createVCChannelId) {
        let customVCOwnerId = null;
        for (const [uid, data] of tempVCs.entries()) {
          if (uid.startsWith('voice_')) continue;
          if (data?.vcId === newState.channel.id) { customVCOwnerId = uid; break; }
        }
        if (customVCOwnerId && customVCOwnerId !== newState.member.user.id) {
          await newState.channel.send(`👋 Welcome ${newState.member}! You have joined <@${customVCOwnerId}>'s room.`).catch(err => {
            console.error('Failed to send welcome message to custom VC text chat:', err);
          });
        }
      }

      // Auto-create temp VC when joining the designated "create" channel
      if (createVCChannelId && newState.channel.id === createVCChannelId) {
        try {
          const guild  = newState.guild;
          const user   = newState.member.user;
          const uid    = user.id;

          const tempVC = await guild.channels.create({
            name: `🎙️ ${user.username}`,
            type: ChannelType.GuildVoice,
            parent: vcCategoryId,
            permissionOverwrites: [
              { id: guild.id, deny: [PermissionFlagsBits.Connect] },
              { id: uid, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels] },
            ],
          });

          await newState.setChannel(tempVC);
          tempVCs.set(uid, { vcId: tempVC.id, createdAt: Date.now() });

          const embed = new EmbedBuilder()
            .setTitle('🎙️ Voice Channel Control Center')
            .setDescription(
              'Welcome to your dynamic voice channel dashboard! Use the buttons below or ' +
              'the quick commands to control access, manage members, and configure your room.\n\n' +
              `🔴 **Room Owner:** <@${uid}>\n` +
              `⚫ **Co-Owners:** *None*\n` +
              `🔒 **Status:** Locked (by default)\n` +
              `🚨 **Limit:** \`Unlimited\``
            )
            .setColor('#ff3333')
            .addFields({
              name: '🖤 Control Commands',
              value:
                '▪️ Use the **Lock** button to lock/unlock your channel\n' +
                '▪️ Use the **Co-own** button to promote a user\n' +
                '▪️ Use the **Allow Access** button to grant entry\n' +
                '▪️ Use the **Block User** button to block someone',
              inline: false,
            })
            .setFooter({ text: 'Psybot Room Manager | Red & Black Edition', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

          const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`vc_edit_${uid}`).setLabel('Edit Room').setStyle(ButtonStyle.Secondary).setEmoji('⚙️'),
            new ButtonBuilder().setCustomId(`vc_coown_${uid}`).setLabel('Co-own').setStyle(ButtonStyle.Secondary).setEmoji('👥'),
            new ButtonBuilder().setCustomId(`vc_lock_${uid}`).setLabel('Lock').setStyle(ButtonStyle.Danger).setEmoji('🔒')
          );
          const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`vc_kick_${uid}`).setLabel('Kick User').setStyle(ButtonStyle.Danger).setEmoji('👢'),
            new ButtonBuilder().setCustomId(`vc_access_${uid}`).setLabel('Allow Access').setStyle(ButtonStyle.Secondary).setEmoji('🔓'),
            new ButtonBuilder().setCustomId(`vc_block_${uid}`).setLabel('Block User').setStyle(ButtonStyle.Danger).setEmoji('⛔')
          );

          if (typeof tempVC.send === 'function') {
            await tempVC.send({ content: `${newState.member}`, embeds: [embed], components: [row1, row2] });
          }
          console.log(`✅ Created temp VC for ${user.username}: ${tempVC.name}`);
        } catch (err) {
          console.error('Error creating temp VC:', err);
        }
      }
    }

    // ── User left a voice channel ─────────────────────────────────────────────
    if (oldState.channel && !newState.channel) {
      // Voice leave logger
      try {
        const cfgLeave = getLogConfig();
        const voiceLogChannel = oldState.guild.channels.cache.get(cfgLeave.voiceLog || '1505907978992353280');
        if (voiceLogChannel) {
          const embed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTimestamp()
            .setDescription(
              `📤 **Voice Leave**\n\n` +
              `**User:** ${oldState.member.user} ( @${oldState.member.user.username} )\n` +
              `**Channel:** <#${oldState.channel.id}> ( \`${oldState.channel.name}\` )\n` +
              `**Time:** <t:${Math.floor(Date.now() / 1000)}:R>`
            );
          await voiceLogChannel.send({ embeds: [embed] });
        }
      } catch (err) {
        console.error('Failed to send voice channel leave log:', err);
      }

      try {
        const userId = newState.member.user.id;

        // Remove voice XP tracking
        if (tempVCs.has(`voice_${userId}`)) {
          tempVCs.delete(`voice_${userId}`);
        }

        // Delete temp VC if the owner left
        const tempVCData = tempVCs.get(userId);
        if (tempVCData) {
          const vcChannel = oldState.guild.channels.cache.get(tempVCData.vcId);
          if (vcChannel) {
            await vcChannel.delete().catch(err => console.error('Failed to delete temp VC on leave:', err));
            console.log('🗑️ Deleted temp VC because owner left');
          }
          tempVCs.delete(userId);
        }
      } catch (err) {
        console.error('Error cleaning up temp VC:', err);
      }
    }

    // ── User moved between channels ───────────────────────────────────────────
    if (oldState.channel && newState.channel && oldState.channel !== newState.channel) {
      try {
        const userId     = newState.member.user.id;
        const tempVCData = tempVCs.get(userId);

        if (tempVCData && oldState.channel.id === tempVCData.vcId) {
          const vcChannel = oldState.guild.channels.cache.get(tempVCData.vcId);
          if (vcChannel) {
            await vcChannel.delete().catch(err => console.error('Failed to delete temp VC on switch:', err));
            console.log('🗑️ Deleted temp VC because owner left');
          }
          tempVCs.delete(userId);
        }
      } catch (err) {
        console.error('Error handling VC switch:', err);
      }
    }
  });
}

module.exports = { register, tempVCs };
