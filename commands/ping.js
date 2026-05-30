const { EmbedBuilder } = require('discord.js');
const os = require('os');
const axios = require('axios');

// Helper to generate progress bars
function generateProgressBar(percent, length = 10) {
  const filledCount = Math.round((percent / 100) * length);
  const emptyCount = length - filledCount;
  const filledChar = '■';
  const emptyChar = '□';
  return `[${filledChar.repeat(Math.max(0, filledCount))}${emptyChar.repeat(Math.max(0, emptyCount))}]`;
}

// Helper to get CPU Usage
function getCpuUsage() {
  return new Promise((resolve) => {
    const startCpus = os.cpus();
    setTimeout(() => {
      const endCpus = os.cpus();
      let idleDifference = 0;
      let totalDifference = 0;

      for (let i = 0; i < startCpus.length; i++) {
        const start = startCpus[i].times;
        const end = endCpus[i].times;
        const idleDelta = end.idle - start.idle;
        const totalDelta = Object.values(end).reduce((a, b) => a + b) - Object.values(start).reduce((a, b) => a + b);
        idleDifference += idleDelta;
        totalDifference += totalDelta;
      }

      const percent = 100 - Math.floor((idleDifference / totalDifference) * 100);
      resolve(percent);
    }, 100);
  });
}

module.exports = {
  name: 'ping',
  description: 'Replies with advanced system diagnostics and latency metrics',
  async execute(message) {
    const startTime = Date.now();
    const sent = await message.reply({ content: '🔍 Gathering core diagnostics (this may take a moment)...' });
    
    // Calculate basic latency
    const roundtrip = Date.now() - startTime;
    const gateway = message.client.ws.ping;

    // Format Uptime helper
    const totalSeconds = Math.floor(message.client.uptime / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const uptimeString = `\`\`\`bash\n${days}d ${hours}h ${minutes}m ${seconds}s\n\`\`\``;

    // CPU Usage
    const cpuPercent = await getCpuUsage();
    const cpuBar = generateProgressBar(cpuPercent);

    // RAM Usage
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const usedMemBytes = totalMemBytes - freeMemBytes;
    
    const totalMemGb = (totalMemBytes / 1024 / 1024 / 1024).toFixed(2);
    const usedMemGb = (usedMemBytes / 1024 / 1024 / 1024).toFixed(2);
    const freeMemGb = (freeMemBytes / 1024 / 1024 / 1024).toFixed(2);
    
    const ramPercent = ((usedMemBytes / totalMemBytes) * 100).toFixed(1);
    const ramBar = generateProgressBar(ramPercent);

    const memUsageRss = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
    const memUsageHeap = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

    // ISP Information
    let ispProvider = 'UNKNOWN PROVIDER';
    let geoRegion = 'Unknown Location';
    try {
      const res = await axios.get('http://ip-api.com/json/');
      if (res.data && res.data.status === 'success') {
        ispProvider = res.data.isp.toUpperCase();
        geoRegion = `${res.data.city}, ${res.data.regionName}, ${res.data.country}`;
      }
    } catch (err) {
      console.error('Failed to fetch ISP info:', err.message);
    }

    // Environment
    const nodeVersion = process.version;
    const djsVersion = require('discord.js').version;

    // Build the exact requested string formats
    const ramText = `• **Host RAM:** \`${usedMemGb} GB\` Used / \`${freeMemGb} GB\` Free (Total: \`${totalMemGb} GB\`)\n• **Bot Process RSS:** \`${memUsageRss} MB\`\n• **Bot Process Heap:** \`${memUsageHeap} MB\``;
    const ispText = `• **ISP Provider:** \`${ispProvider}\`\n• **Georegion Location:** \`${geoRegion}\``;
    
    const embed = new EmbedBuilder()
      .setTitle('👑 Psybot Resources & Control Panel')
      .setColor('#3498db')
      .setDescription(`Authorized administrator CPU power & RAM consumption diagnostics shell.\n\n👤 **Operator**\n\`${message.author.username}\` (ID: \`${message.author.id}\`)\n\n⚡ **CPU Consuming Power**\n**\`${cpuBar}\` ${cpuPercent}%**\n\n💾 **RAM Consuming Memory**\n**\`${ramBar}\` ${ramPercent}%**\n${ramText}\n\n📊 **ISP & Connection Region**\n${ispText}`)
      .addFields(
        { name: '📡 Network Latency', value: `• **API Gateway:** \`${gateway}ms\`\n• **Message Roundtrip:** \`${roundtrip}ms\``, inline: true },
        { name: '⚙️ Runtime', value: `• **Node Engine:** \`${nodeVersion}\`\n• **Library:** \`discord.js v${djsVersion}\``, inline: true },
        { name: '⏱️ Core Engine Uptime', value: uptimeString, inline: false }
      )
      .setFooter({ text: `Access granted under Dev clearance level 1. • ${new Date().toLocaleString()}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

    await sent.edit({ content: '', embeds: [embed] });
  }
};
