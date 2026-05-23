const { EmbedBuilder } = require('discord.js');
const os = require('os');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Persistent state for tracking Core Engine Uptime
const statePath = path.join(__dirname, '../uptime_state.json');
let engineStartTime = Date.now();

try {
  const currentToken = process.env.TOKEN || '';
  let state = {};
  if (fs.existsSync(statePath)) {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  }
  
  if (state.token === currentToken && typeof state.startTime === 'number') {
    // Token did not change, preserve original start time
    engineStartTime = state.startTime;
  } else {
    // Token changed or state does not exist, reset start time
    engineStartTime = Date.now();
    fs.writeFileSync(statePath, JSON.stringify({
      token: currentToken,
      startTime: engineStartTime
    }, null, 2), 'utf8');
  }
} catch (err) {
  engineStartTime = Date.now();
}

// Helper to calculate CPU usage ticks
function getCpuUsage() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });
  return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
}

// Helper to draw a visual progress bar
function drawProgressBar(percentage, size = 10) {
  const cleanPercentage = Math.min(Math.max(percentage, 0), 100);
  const progress = Math.round((cleanPercentage / 100) * size);
  const emptyProgress = size - progress;
  const progressText = '■'.repeat(Math.max(0, progress));
  const emptyProgressText = '□'.repeat(Math.max(0, emptyProgress));
  return `\`[${progressText}${emptyProgressText}]\` **${cleanPercentage.toFixed(1)}%**`;
}

module.exports = {
  name: 'info',
  description: 'Displays advanced connection, CPU power, and RAM utilization metrics',
  async execute(message) {
    // Check if the author is the specific developer ID
    const targetDevId = '1105072573580062790';
    if (message.author.id !== targetDevId) {
      return message.reply({ content: '❌ You do not have permission to view advanced diagnostics.' });
    }

    const startCpu = getCpuUsage();
    const startTime = Date.now();
    const sent = await message.reply({ content: '📊 Querying active system cores & network interfaces...' });
    const endCpu = getCpuUsage();
    const roundtrip = Date.now() - startTime;
    const gateway = message.client.ws.ping;

    // Calculate real-time CPU Consuming Power percentage
    const idleDiff = endCpu.idle - startCpu.idle;
    const totalDiff = endCpu.total - startCpu.total;
    const cpuUsagePercent = totalDiff > 0 ? (100 - (100 * idleDiff) / totalDiff) : 0.0;

    // Gather ISP Info without any IP addresses
    let isp = 'Unknown Provider';
    let geo = 'Unknown Location';
    try {
      const netRes = await axios.get('https://ipapi.co/json/', { timeout: 3000 });
      if (netRes && netRes.data) {
        isp = netRes.data.org || isp;
        geo = `${netRes.data.city}, ${netRes.data.region}, ${netRes.data.country_name}` || geo;
      }
    } catch (e) {
      // Gracefully fall back if location API fails
    }

    // RAM Metrics (Memory Consuming)
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const usedMemBytes = totalMemBytes - freeMemBytes;
    
    const totalMemGb = (totalMemBytes / 1024 / 1024 / 1024).toFixed(2);
    const usedMemGb = (usedMemBytes / 1024 / 1024 / 1024).toFixed(2);
    const freeMemGb = (freeMemBytes / 1024 / 1024 / 1024).toFixed(2);
    const ramUsagePercent = (usedMemBytes / totalMemBytes) * 100;

    // Node process memory consumption
    const processRssMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
    const processHeapMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

    // Core Runtime Uptime calculations (Persisted based on Token)
    const uptimeSeconds = Math.floor((Date.now() - engineStartTime) / 1000);
    const uptimeDays = Math.floor(uptimeSeconds / 86400);
    const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptimeStr = `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds % 60}s`;

    // Build Embed
    const embed = new EmbedBuilder()
      .setTitle('👑 Psybot Resources & Control Panel')
      .setColor('#00d0ff')
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setDescription('Authorized administrator CPU power & RAM consumption diagnostics shell.')
      .addFields(
        { name: '👤 Operator', value: `\`${message.author.tag}\` (ID: \`${message.author.id}\`)`, inline: false },
        { 
          name: '⚡ CPU Consuming Power', 
          value: drawProgressBar(cpuUsagePercent, 12), 
          inline: false 
        },
        { 
          name: '💾 RAM Consuming Memory', 
          value: `${drawProgressBar(ramUsagePercent, 12)}\n• **Host RAM:** \`${usedMemGb} GB\` Used / \`${freeMemGb} GB\` Free (Total: \`${totalMemGb} GB\`)\n• **Bot Process RSS:** \`${processRssMb} MB\`\n• **Bot Process Heap:** \`${processHeapMb} MB\``, 
          inline: false 
        },
        { 
          name: '📶 ISP & Connection Region', 
          value: `• **ISP Provider:** \`${isp}\`\n• **Georegion Location:** \`${geo}\``, 
          inline: false 
        },
        { 
          name: '📡 Network Latency', 
          value: `• **API Gateway:** \`${gateway}ms\`\n• **Message Roundtrip:** \`${roundtrip}ms\``, 
          inline: true 
        },
        { 
          name: '⚙️ Runtime', 
          value: `• **Node Engine:** \`${process.version}\`\n• **Library:** \`discord.js v${require('discord.js').version}\``, 
          inline: true 
        },
        { 
          name: '⏱️ Core Engine Uptime', 
          value: `\`\`\`ansi\n\u001b[1;36m${uptimeStr}\u001b[0m\`\`\``, 
          inline: false 
        }
      )
      .setFooter({ text: 'Access granted under Dev clearance level 1.', iconURL: message.client.user.displayAvatarURL() })
      .setTimestamp();

    await sent.edit({ content: '', embeds: [embed] });
  }
};
