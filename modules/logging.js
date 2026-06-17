'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getLogConfig } = require('../utils/logConfig');
const { parseTime } = require('../utils/parseUtils');

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Converts a UTC millisecond timestamp into a Discord message snowflake ID.
 * @param {number} ms
 * @returns {string}
 */
function msToSnowflake(ms) {
  return ((BigInt(ms) - 1420070400000n) << 22n).toString();
}

/**
 * Formats a UTC millisecond timestamp as IST time string (e.g. "2:30pm").
 * @param {number} ms
 * @returns {string}
 */
function formatIST(ms) {
  const t    = new Date(ms + 5.5 * 60 * 60 * 1000);
  const h    = t.getUTCHours();
  const m    = t.getUTCMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  const dh   = h % 12 || 12;
  return `${dh}:${m}${ampm}`;
}

/**
 * Fetches all log messages within [startSnowflake, endSnowflake] from a channel,
 * returning an array of formatted "[HH:MM AM] text" strings.
 * @param {import('discord.js').TextChannel} channel
 * @param {string} startSnowflake
 * @param {string} endSnowflake
 * @returns {Promise<string[]>}
 */
async function fetchLogList(channel, startSnowflake, endSnowflake) {
  const logList = [];
  let lastId = startSnowflake;
  let keepFetching = true;

  while (keepFetching && logList.length < 100) {
    const fetched = await channel.messages.fetch({ after: lastId, limit: 100 }).catch(() => null);
    if (!fetched || fetched.size === 0) break;

    const sorted = [...fetched.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    for (const msg of sorted) {
      if (BigInt(msg.id) > BigInt(endSnowflake)) { keepFetching = false; break; }
      lastId = msg.id;

      let logText = msg.content || '';
      if (msg.embeds?.length > 0) {
        logText = msg.embeds[0].description || msg.embeds[0].title || '';
      }
      logText = (logText || '').replace(/\n+/g, ' ').trim() || '[No text content / embed description]';

      const msgTime  = new Date(msg.createdTimestamp + 5.5 * 60 * 60 * 1000);
      const hours    = msgTime.getUTCHours();
      const minutes  = msgTime.getUTCMinutes().toString().padStart(2, '0');
      const ampm     = hours >= 12 ? 'PM' : 'AM';
      const dh       = hours % 12 || 12;
      logList.push(`\`[${dh}:${minutes} ${ampm}]\` ${logText}`);
    }
    if (fetched.size < 100) break;
  }
  return logList;
}

/**
 * Builds the paginated embed + optional navigation buttons for log results.
 * @param {string}   subcommand
 * @param {string[]} logList
 * @param {number}   page
 * @param {number}   startMs
 * @param {number}   endMs
 * @param {string}   dateStr
 * @param {string}   startTimeStr
 * @param {string}   endTimeStr
 * @returns {{ embed: EmbedBuilder, row?: ActionRowBuilder }}
 */
function buildLogResponse(subcommand, logList, page, startMs, endMs, dateStr, startTimeStr, endTimeStr) {
  const logsPerPage  = 10;
  const totalPages   = Math.ceil(logList.length / logsPerPage) || 1;
  const clampedPage  = Math.min(Math.max(page, 1), totalPages);
  const pageLogs     = logList.slice((clampedPage - 1) * logsPerPage, clampedPage * logsPerPage);

  const embed = new EmbedBuilder()
    .setTitle(`📋 ${subcommand.toUpperCase()} Logs`)
    .setDescription(
      `**Date:** \`${dateStr}\`\n**Range:** \`${startTimeStr}\` to \`${endTimeStr}\` (IST)\n\n` +
      (pageLogs.length > 0 ? pageLogs.join('\n') : '*No logs found for this timeframe.*')
    )
    .setColor('#0f8c8c')
    .setFooter({ text: `Page ${clampedPage} of ${totalPages} • Total Logs: ${logList.length}` })
    .setTimestamp();

  if (totalPages <= 1) return { embed };

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`logpage_${subcommand}_${startMs}_${endMs}_${clampedPage - 1}`)
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(clampedPage <= 1),
    new ButtonBuilder()
      .setCustomId(`logpage_${subcommand}_${startMs}_${endMs}_${clampedPage + 1}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(clampedPage >= totalPages)
  );
  return { embed, row };
}

/**
 * Resolves the log channel ID for a given subcommand using the stored config.
 * @param {string} subcommand
 * @returns {string|undefined}
 */
function resolveLogChannelId(subcommand) {
  const cfg = getLogConfig();
  return {
    voice:    cfg.voiceLog,
    messages: cfg.messageLog,
    mute:     cfg.muteLog,
    role:     cfg.roleLog,
  }[subcommand];
}

// ---------------------------------------------------------------------------
// /log command handler
// ---------------------------------------------------------------------------

/**
 * Handles the /log slash command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleLogCommand(interaction) {
  const subcommand  = interaction.options.getSubcommand();
  const startTimeStr = interaction.options.getString('start');
  const endTimeStr   = interaction.options.getString('end');
  const pageOpt      = interaction.options.getInteger('page') || 1;

  const nowIST       = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const defaultDate  = nowIST.toISOString().split('T')[0];
  const dateStr      = interaction.options.getString('date') || defaultDate;

  const startMs = parseTime(dateStr, startTimeStr);
  const endMs   = parseTime(dateStr, endTimeStr);

  if (!startMs || !endMs) {
    return interaction.reply({
      content: '❌ Invalid time or date format. Use `10am`, `2:30pm`, or `14:00` for times, and `YYYY-MM-DD` for date.',
      ephemeral: true,
    });
  }
  if (startMs >= endMs) {
    return interaction.reply({ content: '❌ Start time must be before end time!', ephemeral: true });
  }

  const targetChannelId = resolveLogChannelId(subcommand);
  if (!targetChannelId) {
    return interaction.reply({ content: '❌ Log channel configuration not found.', ephemeral: true });
  }

  const channel = await interaction.guild.channels.fetch(targetChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    return interaction.reply({ content: '❌ Log channel not found or not text-based.', ephemeral: true });
  }

  await interaction.deferReply();

  try {
    const logList = await fetchLogList(channel, msToSnowflake(startMs), msToSnowflake(endMs));
    const { embed, row } = buildLogResponse(subcommand, logList, pageOpt, startMs, endMs, dateStr, startTimeStr, endTimeStr);
    return interaction.editReply({ embeds: [embed], components: row ? [row] : [] });
  } catch (err) {
    console.error('Error querying logs:', err);
    return interaction.editReply({ content: '❌ An error occurred while fetching logs.' });
  }
}

// ---------------------------------------------------------------------------
// Log pagination button handler
// ---------------------------------------------------------------------------

/**
 * Handles the logpage_<subcommand>_<startMs>_<endMs>_<page> button.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleLogPageButton(interaction) {
  const [, subcommand, startMsStr, endMsStr, pageStr] = interaction.customId.split('_');
  const startMs = Number(startMsStr);
  const endMs   = Number(endMsStr);
  const page    = Number(pageStr);

  await interaction.deferUpdate();

  try {
    const targetChannelId = resolveLogChannelId(subcommand);
    if (!targetChannelId) return;

    const channel = await interaction.guild.channels.fetch(targetChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const logList = await fetchLogList(channel, msToSnowflake(startMs), msToSnowflake(endMs));

    const startDate = new Date(startMs + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { embed, row } = buildLogResponse(
      subcommand, logList, page, startMs, endMs,
      startDate, formatIST(startMs), formatIST(endMs)
    );
    await interaction.editReply({ embeds: [embed], components: row ? [row] : [] });
  } catch (err) {
    console.error('Error updating log page:', err);
  }
}

module.exports = { handleLogCommand, handleLogPageButton };
