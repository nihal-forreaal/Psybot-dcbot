'use strict';

const { ChannelType, EmbedBuilder } = require('discord.js');
const vcDatabase = require('../utils/vcDatabase');
const { generateVcPanel } = require('../utils/vcPanelGenerator');
const { getLogConfig } = require('../utils/logConfig');

/**
 * Registers the voiceStateUpdate event handler to support dynamic "Join to Create" channels,
 * voice state loggers, and automatic Custom VC Panel operations.
 * @param {import('discord.js').Client} client
 */
function register(client) {
  const targetChannelId = process.env.JOIN_TO_CREATE_CHANNEL_ID || '1505260263924961330';

  client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
      const member = newState.member;
      if (!member) return;

      // ── Track voice time stats ─────────────────────────────────────────────
      try {
        const { trackVoiceJoin, trackVoiceLeave } = require('../modules/userStats');
        const guildId = (newState.guild || oldState.guild)?.id;
        const userId  = member.id;
        // User joined a channel
        if (!oldState.channelId && newState.channelId) {
          trackVoiceJoin(guildId, userId, newState.channelId);
        }
        // User left a channel
        if (oldState.channelId && !newState.channelId) {
          trackVoiceLeave(guildId, userId, oldState.channelId);
        }
        // User moved channels — close old, open new
        if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
          trackVoiceLeave(guildId, userId, oldState.channelId);
          trackVoiceJoin(guildId, userId, newState.channelId);
        }
      } catch (err) {
        console.error('[UserStats] Failed to track voice state:', err.message);
      }

      try {
        const cfg = getLogConfig();
        const modLogChannelId = cfg.muteLog || '1512013682002104340';
        const modLogChannel   = newState.guild.channels.cache.get(modLogChannelId);

        if (modLogChannel) {
          const embed = new EmbedBuilder().setTimestamp();
          let title = null;
          let color = '#f1c40f';

          if      (!oldState.serverMute && newState.serverMute)  { title = '🎙️ Server Mute: Enabled';  color = '#ff3333'; }
          else if (oldState.serverMute  && !newState.serverMute) { title = '🎙️ Server Mute: Disabled'; color = '#00ff66'; }
          else if (!oldState.serverDeaf && newState.serverDeaf)  { title = '🎧 Server Deafen: Enabled';  color = '#ff3333'; }
          else if (oldState.serverDeaf  && !newState.serverDeaf) { title = '🎧 Server Deafen: Disabled'; color = '#00ff66'; }
          else if (!oldState.selfMute   && newState.selfMute)    { title = '🎙️ Voice Mute: Enabled';    color = '#ff6600'; }
          else if (oldState.selfMute    && !newState.selfMute)   { title = '🎙️ Voice Mute: Disabled';   color = '#00ff66'; }
          else if (!oldState.selfDeaf   && newState.selfDeaf)    { title = '🎧 Voice Deafen: Enabled';  color = '#ff6600'; }
          else if (oldState.selfDeaf    && !newState.selfDeaf)   { title = '🎧 Voice Deafen: Disabled'; color = '#00ff66'; }

          if (title) {
            const channelMention = newState.channel
              ? `<#${newState.channel.id}>\n\`${newState.channel.name}\``
              : '`Not in a VC`';

            embed
              .setTitle(title)
              .setColor(color)
              .setThumbnail(newState.member.user.displayAvatarURL({ forceStatic: true }))
              .addFields(
                { name: '👤 Member', value: `${newState.member.user}\n\`${newState.member.user.username}\``, inline: true },
                { name: '🔊 Channel', value: channelMention, inline: true },
                { name: '🕒 Occurred', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
              );

            await modLogChannel.send({ embeds: [embed] }).catch(() => {});
          }
        }
      } catch (err) {
        console.error('Failed to send voice state moderation log:', err);
      }

      // ── Voice join / leave / move logger ────────────────────────────────────
      if (newState.channelId && oldState.channelId !== newState.channelId) {
        try {
          const cfgV = getLogConfig();
          const voiceLogChannel = newState.guild.channels.cache.get(cfgV.voiceLog || '1512013680987078696');
          if (voiceLogChannel) {
            const embed = new EmbedBuilder().setTimestamp();
            if (!oldState.channelId) {
              embed
                .setTitle('📥 Voice Join')
                .setColor('#00ff66')
                .setThumbnail(newState.member.user.displayAvatarURL({ forceStatic: true }))
                .addFields(
                  { name: '👤 Member', value: `${newState.member.user}\n\`${newState.member.user.username}\``, inline: true },
                  { name: '🔊 Channel', value: `<#${newState.channel.id}>\n\`${newState.channel.name}\``, inline: true },
                  { name: '🕒 Occurred', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                );
            } else {
              embed
                .setTitle('🔀 Voice Channel Transfer')
                .setColor('#0099ff')
                .setThumbnail(newState.member.user.displayAvatarURL({ forceStatic: true }))
                .addFields(
                  { name: '👤 Member', value: `${newState.member.user}\n\`${newState.member.user.username}\``, inline: true },
                  { name: '📥 From / To', value: `From: <#${oldState.channelId}>\nTo: <#${newState.channelId}>`, inline: true },
                  { name: '🕒 Occurred', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                );
            }
            await voiceLogChannel.send({ embeds: [embed] }).catch(() => {});
          }
        } catch (err) {
          console.error('Failed to send voice channel join log:', err);
        }
      } else if (oldState.channelId && !newState.channelId) {
        try {
          const cfgLeave = getLogConfig();
          const voiceLogChannel = oldState.guild.channels.cache.get(cfgLeave.voiceLog || '1512013680987078696');
          if (voiceLogChannel) {
            const embed = new EmbedBuilder()
              .setTitle('📤 Voice Leave')
              .setColor('#ff3333')
              .setTimestamp()
              .setThumbnail(oldState.member.user.displayAvatarURL({ forceStatic: true }))
              .addFields(
                { name: '👤 Member', value: `${oldState.member.user}\n\`${oldState.member.user.username}\``, inline: true },
                { name: '🔊 Channel', value: `<#${oldState.channel.id}>\n\`${oldState.channel.name}\``, inline: true },
                { name: '🕒 Occurred', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
              );
            await voiceLogChannel.send({ embeds: [embed] }).catch(() => {});
          }
        } catch (err) {
          console.error('Failed to send voice channel leave log:', err);
        }
      }

      // 1. User joins the target "Join to Create" channel
      if (newState.channelId === targetChannelId) {
        const parentCategory = newState.channel.parent;
        
        console.log(`[Join-To-Create] ${member.user.tag} joined the creator channel.`);

        // Create a temporary voice channel
        const tempChannel = await newState.guild.channels.create({
          name: `🎙️│${member.displayName}`,
          type: ChannelType.GuildVoice,
          parent: parentCategory ? parentCategory.id : null,
          permissionOverwrites: [
            {
              id: member.id,
              allow: ['ManageChannels', 'MuteMembers', 'DeafenMembers', 'MoveMembers'],
            }
          ]
        });

        // Save target VC to local database
        vcDatabase.saveVc(tempChannel.id, {
          ownerId: member.id,
          coOwners: [],
          isLocked: false,
          isHidden: false,
          limit: 0
        });

        // Generate and send Custom VC Panel inside the new channel's text chat
        const avatarUrl = client.user.displayAvatarURL({ extension: 'png' });
        const panelData = generateVcPanel(member.id, [], 0, false, false, avatarUrl);
        const panelMessage = await tempChannel.send({
          content: `${member}, welcome to your custom voice channel!`,
          embeds: panelData.embeds,
          components: panelData.components
        });

        // Update database with panel message ID
        vcDatabase.saveVc(tempChannel.id, { panelMessageId: panelMessage.id });

        // Move the member to the new temporary channel
        await member.voice.setChannel(tempChannel);
        console.log(`[Join-To-Create] Created temporary channel: ${tempChannel.name} (ID: ${tempChannel.id})`);
      }

      // 2. User leaves or moves from a channel (cleanup empty temporary channels)
      if (oldState.channelId && oldState.channelId !== newState.channelId) {
        const oldChannel = oldState.channel;
        
        // Check if this channel exists in our database
        const vcRecord = vcDatabase.getVc(oldState.channelId);
        if (vcRecord || (oldChannel && oldChannel.name.startsWith('🎙️│'))) {
          // Fetch members to ensure accuracy
          if (oldChannel && oldChannel.members.size === 0) {
            console.log(`[Join-To-Create] Cleaning up empty temporary voice channel: ${oldChannel.name} (${oldChannel.id})`);
            vcDatabase.deleteVc(oldChannel.id);
            await oldChannel.delete().catch(err => {
              console.error(`[Join-To-Create] Failed to delete empty channel ${oldChannel.id}:`, err.message);
            });
          }
        }
      }
    } catch (err) {
      console.error('[Join-To-Create] Error in voiceStateUpdate handler:', err);
    }
  });
}

module.exports = { register };
