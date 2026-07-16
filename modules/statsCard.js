'use strict';

const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

// ── Colours & Sizes ───────────────────────────────────────────────────────────
const W = 900, H = 500;
const BG       = '#1a1a2e';
const CARD_BG  = '#16213e';
const PANEL_BG = '#0f3460';
const BORDER   = '#2a2a4a';
const ACCENT   = '#e94560';
const GREEN    = '#00d4aa';
const PINK     = '#ff6b9d';
const TEXT     = '#e0e0f0';
const MUTED    = '#8888aa';
const WHITE    = '#ffffff';

// ── Draw Helpers ──────────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}

function drawCircleClip(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
}

function label(ctx, text, x, y, size, color = TEXT, align = 'left', bold = false) {
  ctx.font = `${bold ? '700' : '400'} ${size}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

function badge(ctx, text, x, y, w, h, bg = PANEL_BG, fg = TEXT) {
  roundRect(ctx, x, y, w, h, 8, bg, BORDER);
  label(ctx, text, x + w / 2, y + h / 2 + 6, 13, fg, 'center', true);
}

function drawLineChart(ctx, data, x, y, w, h, color) {
  if (!data || data.length < 2) return;
  const max = Math.max(...data, 1);
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  data.forEach((val, i) => {
    const px = x + (i / (data.length - 1)) * w;
    const py = y + h - (val / max) * h;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.stroke();

  // Fill under chart
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fillStyle = color + '22';
  ctx.fill();
}

function sectionTitle(ctx, icon, title, x, y) {
  label(ctx, icon, x, y, 14, ACCENT, 'left');
  label(ctx, title, x + 22, y, 14, WHITE, 'left', true);
  ctx.fillStyle = BORDER;
  ctx.fillRect(x, y + 8, 200, 1);
}

// ── Main Generator ────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {string}   opts.username
 * @param {string}   opts.discriminator   e.g. "0" or "1234"
 * @param {string}   opts.guildName
 * @param {string}   opts.avatarUrl
 * @param {string}   opts.createdAt       human-readable
 * @param {string}   opts.joinedAt        human-readable
 * @param {number}   opts.msgRank
 * @param {number}   opts.vcRank
 * @param {object}   opts.msgCounts       { 1, 7, 14 }
 * @param {object}   opts.vcHours         { 1, 7, 14 }
 * @param {Array}    opts.topMsg          [{ channelId, channelName, count }]
 * @param {Array}    opts.topVc           [{ channelId, channelName, hours }]
 * @param {number[]} opts.msgChart        14 values
 * @param {number[]} opts.vcChart         14 values
 * @returns {Promise<Buffer>}
 */
async function generateStatsCard(opts) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ── Background ──────────────────────────────────────────────────────────────
  roundRect(ctx, 0, 0, W, H, 16, BG);

  // ── Header Bar ──────────────────────────────────────────────────────────────
  roundRect(ctx, 0, 0, W, 110, 16, CARD_BG);
  ctx.fillStyle = CARD_BG;
  ctx.fillRect(0, 100, W, 10); // flush bottom

  // Avatar circle
  const avatarX = 28, avatarY = 18, avatarR = 36;
  try {
    const img = await loadImage(opts.avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, avatarX, avatarY, avatarR * 2, avatarR * 2);
    ctx.restore();
  } catch {
    // Fallback circle
    ctx.fillStyle = PANEL_BG;
    ctx.beginPath();
    ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Avatar border
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR + 2, 0, Math.PI * 2);
  ctx.stroke();

  // Username / guild
  const tx = avatarX + avatarR * 2 + 18;
  label(ctx, opts.username, tx, 52, 26, WHITE, 'left', true);
  const unW = ctx.measureText(opts.username).width;
  if (opts.discriminator && opts.discriminator !== '0') {
    label(ctx, `#${opts.discriminator}`, tx + unW + 6, 52, 18, MUTED, 'left');
  }
  label(ctx, `🏠 ${opts.guildName}`, tx, 78, 14, MUTED);

  // Created / Joined badges
  badge(ctx, `📅 ${opts.createdAt}`, W - 390, 22, 172, 30, '#0d2137', '#88aacc');
  badge(ctx, `🚪 ${opts.joinedAt}`, W - 200, 22, 172, 30, '#0d2137', '#88aacc');
  label(ctx, 'Created On', W - 390 + 86, 20, 10, MUTED, 'center');
  label(ctx, 'Joined On', W - 200 + 86, 20, 10, MUTED, 'center');

  // ── Three Panels ───────────────────────────────────────────────────────────
  const panelY = 122, panelH = 160;

  // LEFT — Server Ranks
  roundRect(ctx, 18, panelY, 190, panelH, 10, CARD_BG, BORDER);
  sectionTitle(ctx, '🏆', 'Server Ranks', 30, panelY + 22);

  const rankPills = [
    { label: 'Message', rank: opts.msgRank },
    { label: 'Voice',   rank: opts.vcRank },
  ];
  rankPills.forEach((p, i) => {
    const py2 = panelY + 44 + i * 50;
    roundRect(ctx, 30, py2, 166, 36, 8, PANEL_BG, BORDER);
    label(ctx, p.label, 48, py2 + 23, 14, TEXT, 'left', true);
    label(ctx, `#${p.rank}`, 30 + 166 - 14, py2 + 23, 15, ACCENT, 'right', true);
  });

  // CENTER — Messages
  roundRect(ctx, 220, panelY, 210, panelH, 10, CARD_BG, BORDER);
  sectionTitle(ctx, '#', 'Messages', 232, panelY + 22);

  [[1, opts.msgCounts[1]], [7, opts.msgCounts[7]], [14, opts.msgCounts[14]]].forEach(([d, v], i) => {
    const ry = panelY + 44 + i * 40;
    label(ctx, `${d}d`, 232, ry + 14, 14, MUTED, 'left', true);
    label(ctx, `${v} messages`, 262, ry + 14, 13, TEXT);
  });

  // RIGHT — Voice Activity
  roundRect(ctx, 444, panelY, 210, panelH, 10, CARD_BG, BORDER);
  sectionTitle(ctx, '🔊', 'Voice Activity', 456, panelY + 22);

  [[1, opts.vcHours[1]], [7, opts.vcHours[7]], [14, opts.vcHours[14]]].forEach(([d, v], i) => {
    const ry = panelY + 44 + i * 40;
    label(ctx, `${d}d`, 456, ry + 14, 14, MUTED, 'left', true);
    label(ctx, `${v} hours`, 486, ry + 14, 13, TEXT);
  });

  // ── Bottom Row ─────────────────────────────────────────────────────────────
  const botY = 298, botH = 165;

  // Bottom LEFT — Top Channels
  roundRect(ctx, 18, botY, 416, botH, 10, CARD_BG, BORDER);
  sectionTitle(ctx, '📊', 'Top Channels & Applications', 30, botY + 22);

  const allChannels = [
    ...opts.topMsg.map(c => ({ icon: '#', name: c.channelName || `#${c.channelId}`, stat: `${c.count} msgs`, color: GREEN })),
    ...opts.topVc.map(c => ({ icon: '🔊', name: c.channelName || `VC-${c.channelId}`, stat: `${c.hours}h`, color: PINK })),
  ].slice(0, 4);

  allChannels.forEach((ch, i) => {
    const cy = botY + 44 + i * 32;
    roundRect(ctx, 30, cy, 392, 26, 6, PANEL_BG, BORDER);
    label(ctx, ch.icon, 42, cy + 18, 12, ch.color);
    label(ctx, ch.name, 62, cy + 18, 13, TEXT);
    label(ctx, ch.stat, 30 + 392 - 10, cy + 18, 12, MUTED, 'right');
  });

  // Bottom RIGHT — Charts
  const chartX = 448, chartY = botY, chartW = W - chartX - 18, chartH = botH;
  roundRect(ctx, chartX, chartY, chartW, chartH, 10, CARD_BG, BORDER);

  label(ctx, 'Charts', chartX + 14, chartY + 22, 14, WHITE, 'left', true);

  // Legend
  ctx.fillStyle = GREEN; ctx.fillRect(chartX + chartW - 120, chartY + 12, 10, 10);
  label(ctx, 'Message', chartX + chartW - 106, chartY + 22, 11, TEXT);
  ctx.fillStyle = PINK; ctx.fillRect(chartX + chartW - 50, chartY + 12, 10, 10);
  label(ctx, 'Voice', chartX + chartW - 36, chartY + 22, 11, TEXT);

  // Clip chart area
  ctx.save();
  roundRect(ctx, chartX + 10, chartY + 34, chartW - 20, chartH - 50, 6, '#0d1b2a');
  ctx.clip();

  drawLineChart(ctx, opts.msgChart, chartX + 10, chartY + 34, chartW - 20, chartH - 50, GREEN);
  drawLineChart(ctx, opts.vcChart,  chartX + 10, chartY + 34, chartW - 20, chartH - 50, PINK);
  ctx.restore();

  // ── Footer ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = BORDER;
  ctx.fillRect(18, H - 34, W - 36, 1);
  label(ctx, `Server Lookback: Last 14 days — Timezone: UTC`, 28, H - 12, 11, MUTED);
  label(ctx, '⚡ Powered by Psybot', W - 28, H - 12, 11, MUTED, 'right');

  return canvas.toBuffer('image/png');
}

module.exports = { generateStatsCard };
