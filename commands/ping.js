const { EmbedBuilder } = require('discord.js');
const os = require('os');

module.exports = {
  name: 'ping',
  description: 'Replies with advanced system diagnostics and latency metrics',
  async execute(message) {
    const startTime = Date.now();
    
    // Initial message to measure message trip latency
    const sent = await message.reply({ content: '🔍 Gathering diagnostics...' });
    const roundtrip = Date.now() - startTime;
    const gateway = message.client.ws.ping;

    // Format Uptime helper
    const totalSeconds = Math.floor(message.client.uptime / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const uptimeString = `${days > 0 ? `${days}d ` : ''}${hours > 0 ? `${hours}h ` : ''}${minutes > 0 ? `${minutes}m ` : ''}${seconds}s`;

    // Latency status indicator
    const getStatusEmoji = (ms) => {
      if (ms < 100) return '🟢 Excellent';
      if (ms < 250) return '🟡 Moderate';
      return '🔴 High';
    };

    // System stats
    const memUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const nodeVersion = process.version;
    const djsVersion = require('discord.js').version;
    const platform = `${os.type()} ${os.arch()}`;

    // CPU Info
    const cpus = os.cpus();
    const cpuModel = cpus[0] ? cpus[0].model.trim() : 'Unknown';
    const cpuCores = cpus.length;

    // Bot Statistics
    const guildCount = message.client.guilds.cache.size;
    const channelCount = message.client.channels.cache.size;
    const userCount = message.client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

    // OS Uptime
    const osUptimeDays = Math.floor(os.uptime() / 86400);

    const embed = new EmbedBuilder()
      .setTitle('🏓 Psybot Advanced System Diagnostics')
      .setColor('#0f8c8c')
      .setDescription('Extensive live latency metrics, system resources, and bot statistics.')
      .addFields(
        { name: '📡 Network Latency', value: `Gateway: \`${gateway}ms\` (${getStatusEmoji(gateway)})\nRoundtrip: \`${roundtrip}ms\` (${getStatusEmoji(roundtrip)})`, inline: false },
        { name: '📊 Bot Statistics', value: `Servers: \`${guildCount}\`\nChannels: \`${channelCount}\`\nTotal Users: \`${userCount}\``, inline: true },
        { name: '⏱️ Uptimes', value: `Bot: \`${uptimeString}\`\nHost Server: \`${osUptimeDays} days\``, inline: true },
        { name: '💻 CPU Configuration', value: `Model: \`${cpuModel}\`\nLogical Cores: \`${cpuCores}\``, inline: false },
        { name: '💾 Memory Usage', value: `Process Heap: \`${memUsage} MB\`\nHost Total: \`${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB\``, inline: true },
        { name: '⚙️ Environment', value: `Node.js: \`${nodeVersion}\`\nDiscord.js: \`v${djsVersion}\``, inline: true },
        { name: '🖥️ Platform Host', value: `OS: \`${platform}\``, inline: true }
      )
      .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    await sent.edit({ content: '', embeds: [embed] });
  }
};
