'use strict';

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'ticket',
  description: 'Send the ticket system button panel',
  async execute(message) {
    try {
      // Check if user is administrator or has the admin role
      const adminRoleId = process.env.ADMIN_ROLE_ID;
      const isAdmin = message.member.permissions.has('Administrator') || (adminRoleId && message.member.roles.cache.has(adminRoleId));
      if (!isAdmin) {
        return message.reply('❌ You do not have permission to use this command.');
      }

      const ticketChannelId = process.env.TICKET_PANEL_CHANNEL_ID || '1505164021186433075';
      const targetChannel = await message.guild.channels.fetch(ticketChannelId).catch(() => null);
      if (!targetChannel) {
        return message.reply('❌ Ticket panel channel not found.');
      }

      const embed = new EmbedBuilder()
        .setTitle('🎮 Support Ticket Portal')
        .setDescription(
          'Welcome to the **Psybot Support Hub**. If you require assistance with matchmaking, tournaments, player reports, or server roles, click the button below to start a private session with our staff.\n\n' +
          '🚨 **Ticket Guidelines:**\n' +
          '▪️ Describe your issue or report in detail in your first message.\n' +
          '▪️ Attach any relevant screenshots or clip links if applicable.\n' +
          '▪️ Be patient; a gaming moderator will assist you shortly.\n' +
          '▪️ Creating duplicate or spam tickets will lead to a temporary blacklist.'
        )
        .setColor('#e74c3c') // Gaming red
        .addFields(
          { name: '🕒 Service Hours', value: '`24/7 Support`', inline: true },
          { name: '📁 Topics Handled', value: '`Tournaments`, `Reports`, `Role Issues`', inline: true }
        )
        .setFooter({ text: 'Psybot Gaming Support Services', iconURL: message.client.user.displayAvatarURL() })
        .setTimestamp();

      const button = new ButtonBuilder()
        .setCustomId('create_ticket')
        .setLabel('Create Support Ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🎫');

      const row = new ActionRowBuilder().addComponents(button);

      await targetChannel.send({ embeds: [embed], components: [row] });
      await message.reply(`✅ Ticket panel sent to <#${ticketChannelId}>`);
    } catch (err) {
      console.error('Error executing ticket command:', err);
    }
  }
};
