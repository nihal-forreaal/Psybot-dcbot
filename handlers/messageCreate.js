'use strict';

const { EmbedBuilder } = require('discord.js');
const { getLogConfig } = require('../utils/logConfig');

const LOG_CHANNEL_ID = '1505905409003884634'; // Message log (outgoing) channel
const N_WORD_REGEX   = /n+[i\u00a11\u00ec\u00ed\u00ee\u00ef]+g+a+|n+g+a+|n+i+g+e+r+|n+i+g+g+e+r+/i;

/**
 * Registers the messageCreate, messageDelete, and messageUpdate events.
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Collection} commands  The loaded prefix command collection.
 * @param {Function} updateServerStats  Callback to sync stats channels (passed from index.js).
 * @param {string}   prefix             The bot command prefix (default: '!').
 */
function register(client, commands, updateServerStats, prefix = '!') {
  // ── messageCreate ─────────────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Word filter — remove slurs and send a 5-second warning
    const normalizedContent = message.content.toLowerCase().replace(/[\s\-_.]/g, '');
    if (N_WORD_REGEX.test(normalizedContent) || N_WORD_REGEX.test(message.content)) {
      try {
        await message.delete();
        const warn = await message.channel.send(`⚠️ ${message.author}, that word is not allowed here.`);
        setTimeout(() => warn.delete().catch(() => {}), 5000);
      } catch (err) {
        console.error('Failed to delete message containing restricted word:', err.message);
      }
      return;
    }

    console.log(`[MESSAGE] ${message.author.tag} (${message.author.id}) in ${message.guild?.name || 'DM'}: "${message.content}"`);

    // React when a specific user is pinged
    if (message.mentions.users.has('1105072573580062790')) {
      message.react('1510273361455091752').catch(err => console.error('Failed to react to specific ping:', err));
    }

    // Random letter generator for a specific channel
    if (message.channel.id === '1445395976495042641') {
      const numMatch = message.content.trim().match(/^(\d+)$/);
      if (numMatch) {
        const count    = Math.min(parseInt(numMatch[1], 10), 100);
        const chars    = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let i = 0; i < count; i++) {
          await message.channel.send(chars.charAt(Math.floor(Math.random() * chars.length))).catch(err => console.error('Failed to send letter:', err));
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (parseInt(numMatch[1], 10) > 100) {
          await message.channel.send('⚠️ *Count capped at 100 to prevent rate limits.*').catch(() => {});
        }
        return;
      }
    }

    // Log all messages to the log channel (excluding the log channel itself)
    if (message.guild && message.channel.id !== LOG_CHANNEL_ID) {
      try {
        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
          const embed = new EmbedBuilder()
            .setColor('#0f8c8c')
            .setDescription(
              `**Channel:** <#${message.channel.id}> ( <#${message.channel.id}> )\n` +
              `**Message ID:** ${message.id}\n` +
              `**Message author:** ${message.author.tag} ( <@${message.author.id}> )\n` +
              `**Message created:** <t:${Math.floor(message.createdTimestamp / 1000)}:R>\n\n` +
              `**Message**\n${message.content || '[No Text Content]'}`
            )
            .setTimestamp(message.createdAt);

          const firstAttachment = message.attachments.first();
          if (firstAttachment?.contentType?.startsWith('image/')) {
            embed.setImage(firstAttachment.url);
          }
          await logChannel.send({ embeds: [embed] });
        }
      } catch (err) {
        console.error('Failed to log message:', err);
      }
    }

    // ── Auto-responses ───────────────────────────────────────────────────────
    const normalized = message.content.trim().toLowerCase();
    const plain      = normalized.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');

    if (plain === 'who is the king') return message.channel.send('zypher');

    if (normalized === '!syncstats') {
      if (!message.member.permissions.has('Administrator')) return;
      await message.reply('Syncing stats now...');
      await updateServerStats();
      return message.channel.send('✅ Stats synced successfully!');
    }

    const fakeMatches = normalized.match(/\bfake\b/g) || [];
    if (fakeMatches.length > 0) {
      for (let i = 0; i < fakeMatches.length; i++) {
        await message.channel.send('ur are the fake one !!');
      }
      return;
    }

    if (/\b(yt|youtube)\b/.test(normalized)) {
      return message.channel.send('Search psybotlive 🤫');
    }

    // ── Prefix command router ─────────────────────────────────────────────────
    if (!message.content.startsWith(prefix)) return;

    const args        = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();
    const command     = commands.get(commandName);
    if (!command) return;

    try {
      await command.execute(message, args);
    } catch (err) {
      console.error(err);
      message.reply('There was an error executing that command.');
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
      .setColor('#e74c3c')
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setDescription(
        `**Author:** ${message.author} (\`${message.author.tag}\`)\n` +
        `**Channel:** <#${message.channel.id}>\n` +
        `**Message ID:** \`${message.id}\`\n\n` +
        `**Content:**\n${message.content || '*No text content (possibly an embed or attachment)*'}`
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

    const oldContent = oldMessage.content ? oldMessage.content.substring(0, 1024) : '*None*';
    const newContent = newMessage.content ? newMessage.content.substring(0, 1024) : '*None*';

    const embed = new EmbedBuilder()
      .setTitle('✏️ Message Edited')
      .setColor('#f1c40f')
      .setThumbnail(newMessage.author.displayAvatarURL({ dynamic: true }))
      .setDescription(
        `**Author:** ${newMessage.author} (\`${newMessage.author.tag}\`)\n` +
        `**Channel:** <#${newMessage.channel.id}>\n` +
        `[Jump to message](${newMessage.url})`
      )
      .addFields(
        { name: '📝 Before', value: oldContent },
        { name: '✅ After',  value: newContent }
      )
      .setTimestamp();
    channel.send({ embeds: [embed] }).catch(() => {});
  });
}

module.exports = { register };
