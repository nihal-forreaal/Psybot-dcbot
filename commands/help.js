'use strict';

const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'help',
  description: 'Lists all available commands.',
  async execute(message) {
    try {
      const prefix = process.env.PREFIX || ',';
      const commands = message.client.commands;

      if (commands.size === 0) {
        return message.reply('❌ No commands available.');
      }

      const embed = new EmbedBuilder()
        .setTitle('🎮 Psybot Support & Help')
        .setDescription(
          `Welcome to the Psybot help console! Use \`${prefix}<command>\` to execute prefix commands.\n\n` +
          `📍 **Current Channel:** <#${message.channel.id}>\n` +
          `─────────────────────────────`
        )
        .setColor('#e74c3c')
        .setFooter({ text: 'Psybot Help Manager', iconURL: message.client.user.displayAvatarURL() })
        .setTimestamp();

      // Filter unique command objects to avoid duplicates from aliases
      const uniqueCommands = new Set(commands.values());
      let commandText = '';

      uniqueCommands.forEach(cmd => {
        const desc = cmd.description || 'No description';
        const aliasList = cmd.aliases && cmd.aliases.length > 0 ? ` (aliases: \`${cmd.aliases.map(a => prefix + a).join(', ')}\`)` : '';
        commandText += `▪️ **\`${prefix}${cmd.name}\`**${aliasList}\n  └─ ${desc}\n\n`;
      });

      embed.addFields({ name: '⚡ Available Commands', value: commandText || 'No commands registered.' });

      await message.reply({ embeds: [embed] });
    } catch (err) {
      console.error('Error executing help command:', err);
    }
  }
};
