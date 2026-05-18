const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'help',
  description: 'Lists all available commands',
  async execute(message) {
    const prefix = process.env.PREFIX || '!';
    const commands = message.client.commands;

    if (commands.size === 0) {
      return message.reply('❌ No commands available.');
    }

    const embed = new EmbedBuilder()
      .setTitle('📚 Command List')
      .setDescription(
        `Use \`${prefix}<command>\` to run a command\n\n` +
        `📍 **Current Channel ID:** \`${message.channel.id}\``
      )
      .setColor('#5865F2')
      .setFooter({ text: 'Need more help? Join the support server!' });

    let commandText = '';
    const excludeCommands = ['kick', 'timeout', 'mute', 'deafen', 'defen', 'delete'];
    commands.forEach(cmd => {
      const desc = cmd.description || 'No description';
      // Skip admin-only and excluded moderation commands from help panel
      if (!desc.includes('admin only') && !excludeCommands.includes(cmd.name.toLowerCase())) {
        commandText += `\`${prefix}${cmd.name}\` - ${desc}\n`;
      }
    });

    if (commandText.length > 1024) {
      // Split into multiple fields if too long
      let fields = [];
      let currentField = '';
      commandText.split('\n').forEach(line => {
        if ((currentField + line).length > 1024) {
          fields.push({ name: '\u200b', value: currentField.trim(), inline: false });
          currentField = line + '\n';
        } else {
          currentField += line + '\n';
        }
      });
      if (currentField.trim()) {
        fields.push({ name: '\u200b', value: currentField.trim(), inline: false });
      }
      embed.addFields(fields);
    } else {
      embed.addFields({ name: '**Commands:**', value: commandText || 'No commands', inline: false });
    }

    message.reply({ embeds: [embed] });
  }
};
