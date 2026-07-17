'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR  = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'userStats.json');

// Auto-create the data directory if it doesn't exist (e.g. fresh deploy)
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[UserStats] Failed to write data:', err.message);
  }
}

function ensureUser(data, guildId, userId) {
  if (!data[guildId]) data[guildId] = {};
  if (!data[guildId][userId]) {
    data[guildId][userId] = { messages: [], voice: [], voiceSessions: {} };
  }
  if (!data[guildId][userId].voiceSessions) data[guildId][userId].voiceSessions = {};
  return data[guildId][userId];
}

function msToHours(ms) {
  return Math.round((ms / 3600000) * 100) / 100;
}

function daysAgo(days) {
  return Date.now() - days * 86400000;
}

// ── Public API ────────────────────────────────────────────────────────────────

function trackMessage(guildId, userId, channelId) {
  const data = readData();
  const user = ensureUser(data, guildId, userId);
  user.messages.push({ channelId, t: Date.now() });
  const cutoff = daysAgo(15);
  user.messages = user.messages.filter(m => m.t > cutoff);
  writeData(data);
}

function trackVoiceJoin(guildId, userId, channelId) {
  const data = readData();
  const user = ensureUser(data, guildId, userId);
  user.voiceSessions[channelId] = { start: Date.now(), channelId };
  writeData(data);
}

function trackVoiceLeave(guildId, userId, channelId) {
  const data = readData();
  const user = ensureUser(data, guildId, userId);
  const session = user.voiceSessions[channelId];
  if (session) {
    const duration = Date.now() - session.start;
    user.voice.push({ channelId, start: session.start, end: Date.now(), duration });
    delete user.voiceSessions[channelId];
    const cutoff = daysAgo(15);
    user.voice = user.voice.filter(v => v.end > cutoff);
    writeData(data);
  }
}

function getStats(guildId, userId) {
  const data = readData();
  const user = (data[guildId] || {})[userId] || { messages: [], voice: [] };
  const windows = [1, 7, 14];
  const msgCounts = {};
  const vcHours = {};
  for (const d of windows) {
    const cutoff = daysAgo(d);
    msgCounts[d] = user.messages.filter(m => m.t > cutoff).length;
    const totalMs = user.voice
      .filter(v => v.end > cutoff)
      .reduce((sum, v) => sum + Math.min(v.duration, v.end - cutoff), 0);
    vcHours[d] = msToHours(totalMs);
  }
  return { msgCounts, vcHours };
}

function getRank(guildId, userId) {
  const data = readData();
  const guildData = data[guildId] || {};
  const cutoff14 = daysAgo(14);
  const scores = Object.entries(guildData).map(([uid, udata]) => {
    const msgs = (udata.messages || []).filter(m => m.t > cutoff14).length;
    const vc = (udata.voice || [])
      .filter(v => v.end > cutoff14)
      .reduce((s, v) => s + v.duration, 0);
    return { uid, msgs, vc };
  });
  scores.sort((a, b) => b.msgs - a.msgs);
  const msgRank = scores.findIndex(s => s.uid === userId) + 1 || scores.length + 1;
  scores.sort((a, b) => b.vc - a.vc);
  const vcRank = scores.findIndex(s => s.uid === userId) + 1 || scores.length + 1;
  return { msgRank, vcRank, totalUsers: scores.length };
}

function getTopChannels(guildId, userId) {
  const data = readData();
  const user = (data[guildId] || {})[userId] || { messages: [], voice: [] };
  const cutoff = daysAgo(14);
  const msgMap = {};
  for (const m of user.messages.filter(x => x.t > cutoff)) {
    msgMap[m.channelId] = (msgMap[m.channelId] || 0) + 1;
  }
  const topMsg = Object.entries(msgMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([channelId, count]) => ({ channelId, count, type: 'msg' }));
  const vcMap = {};
  for (const v of user.voice.filter(x => x.end > cutoff)) {
    vcMap[v.channelId] = (vcMap[v.channelId] || 0) + v.duration;
  }
  const topVc = Object.entries(vcMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([channelId, ms]) => ({ channelId, hours: msToHours(ms), type: 'vc' }));
  return { topMsg, topVc };
}

function getDailyMsgChart(guildId, userId) {
  const data = readData();
  const user = (data[guildId] || {})[userId] || { messages: [] };
  const days = Array(14).fill(0);
  const now = Date.now();
  for (const m of user.messages) {
    const daysOld = Math.floor((now - m.t) / 86400000);
    if (daysOld >= 0 && daysOld < 14) days[13 - daysOld]++;
  }
  return days;
}

function getDailyVcChart(guildId, userId) {
  const data = readData();
  const user = (data[guildId] || {})[userId] || { voice: [] };
  const days = Array(14).fill(0);
  const now = Date.now();
  for (const v of user.voice) {
    const daysOld = Math.floor((now - v.end) / 86400000);
    if (daysOld >= 0 && daysOld < 14) days[13 - daysOld] += v.duration / 3600000;
  }
  return days.map(h => Math.round(h * 100) / 100);
}

module.exports = {
  trackMessage,
  trackVoiceJoin,
  trackVoiceLeave,
  getStats,
  getRank,
  getTopChannels,
  getDailyMsgChart,
  getDailyVcChart,
};
