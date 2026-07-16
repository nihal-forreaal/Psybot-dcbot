'use strict';

const { EmbedBuilder } = require('discord.js');
const { getLogConfig } = require('../utils/logConfig');

/**
 * Registers the messageCreate event to route prefix commands.
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Collection} commands
 * @param {string} prefix
 */
function register(client, commands, prefix = '!') {
  client.on('messageCreate', async message => {
    // Ignore bots
    if (message.author.bot) return;

    // Track message stats for guild users
    if (message.guild) {
      try {
        const { trackMessage } = require('../modules/userStats');
        trackMessage(message.guild.id, message.author.id, message.channel.id);
      } catch (err) {
        console.error('[UserStats] Failed to track message:', err.message);
      }
    }

    // Direct message logs or debugging output
    if (!message.guild) {
      console.log(`[DM] ${message.author.tag}: ${message.content}`);
    }

    // Mirror ticket messages to forum thread if applicable
    if (message.guild && message.channel.name.startsWith('ticket-')) {
      try {
        const { readJsonFile } = require('../utils/jsonUtils');
        const path = require('path');
        const ticketsPath = path.join(__dirname, '..', 'tickets.json');
        const tickets = readJsonFile(ticketsPath, {});
        const ticketData = Object.values(tickets).find(t => t.channelId === message.channel.id);
        
        if (ticketData && ticketData.forumThreadId) {
          const thread = await message.guild.channels.fetch(ticketData.forumThreadId).catch(() => null);
          if (thread) {
            const files = [...message.attachments.values()];
            const content = message.content
              ? `👤 **${message.author.username}** (\`${message.author.id}\`): ${message.content}`
              : `👤 **${message.author.username}** (\`${message.author.id}\`) sent an attachment:`;
            await thread.send({ content, files }).catch(err => console.error('Failed to forward ticket message:', err.message));
          }
        }
      } catch (err) {
        console.error('Error forwarding ticket message to forum:', err.message);
      }
    }
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();
    const command = commands.get(commandName);

    if (!command) return;

    try {
      await command.execute(message, args);
    } catch (err) {
      console.error(`Error executing prefix command: ${commandName}`, err);
      try {
        await message.reply('❌ There was an error trying to execute that command.');
      } catch (replyErr) {
        console.error('Failed to send error reply:', replyErr.message);
      }
    }
  });

  // ── messageDelete ─────────────────────────────────────────────────────────
  client.on('messageDelete', async message => {
    if (message.partial) {
      try { await message.fetch(); } catch { return; }
    }
    if (message.author?.bot) return;
    const cfg = getLogConfig();
    if (!cfg.messageLog) return;
    const channel = message.guild?.channels.cache.get(cfg.messageLog);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Message Deleted')
      .setColor('#ff3333')
      .setThumbnail(message.author.displayAvatarURL({ forceStatic: true }))
      .addFields(
        { name: '👤 Author', value: `${message.author}\n\`${message.author.tag}\``, inline: true },
        { name: '💬 Channel', value: `<#${message.channel.id}>\n\`#${message.channel.name}\``, inline: true },
        { name: '🕒 Occurred', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
        { name: '📝 Content', value: `\`\`\`${message.content || '(No text content / attachment)'}\`\`\``, inline: false }
      )
      .setTimestamp();
    channel.send({ embeds: [embed] }).catch(() => {});
  });

  // ── messageUpdate ─────────────────────────────────────────────────────────
  client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (oldMessage.partial)  { try { await oldMessage.fetch();  } catch { return; } }
    if (newMessage.partial)  { try { await newMessage.fetch();  } catch { return; } }
    if (newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const cfg = getLogConfig();
    if (!cfg.messageLog) return;
    const channel = newMessage.guild?.channels.cache.get(cfg.messageLog);
    if (!channel) return;

    const oldContent = oldMessage.content ? oldMessage.content.substring(0, 1000) : '*None*';
    const newContent = newMessage.content ? newMessage.content.substring(0, 1000) : '*None*';

    const embed = new EmbedBuilder()
      .setTitle('✏️ Message Edited')
      .setColor('#ffaa00')
      .setThumbnail(newMessage.author.displayAvatarURL({ forceStatic: true }))
      .addFields(
        { name: '👤 Author', value: `${newMessage.author}\n\`${newMessage.author.tag}\``, inline: true },
        { name: '💬 Channel', value: `<#${newMessage.channel.id}>\n\`#${newMessage.channel.name}\``, inline: true },
        { name: '🕒 Occurred', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
        { name: '📝 Before', value: `\`\`\`${oldContent}\`\`\``, inline: false },
        { name: '✅ After', value: `\`\`\`${newContent}\`\`\``, inline: false },
        { name: '🔗 Reference', value: `[Jump to message](${newMessage.url})`, inline: false }
      )
      .setTimestamp();
    channel.send({ embeds: [embed] }).catch(() => {});
  });
}

module.exports = { register };
