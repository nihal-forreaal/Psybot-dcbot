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

    const embed = new EmbedBuilder()
      .setTitle('🏓 Psybot System Diagnostics')
      .setColor('#0f8c8c')
      .setDescription('Live latency metrics and system resource indicators.')
      .addFields(
        { name: '📡 Gateway Latency', value: `\`${gateway}ms\` (${getStatusEmoji(gateway)})`, inline: true },
        { name: '⚡ Message Roundtrip', value: `\`${roundtrip}ms\` (${getStatusEmoji(roundtrip)})`, inline: true },
        { name: '⏱️ Bot Uptime', value: `\`${uptimeString}\``, inline: true },
        { name: '💾 Memory Usage', value: `\`${memUsage} MB\` / \`${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB\``, inline: true },
        { name: '⚙️ Environment', value: `Node: \`${nodeVersion}\`\nLibrary: \`discord.js v${djsVersion}\``, inline: true },
        { name: '🖥️ Platform', value: `\`${platform}\``, inline: true }
      )
      .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    await sent.edit({ content: '', embeds: [embed] });
  }
};
