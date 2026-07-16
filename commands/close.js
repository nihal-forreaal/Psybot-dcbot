'use strict';

const fs = require('fs');
const path = require('path');
const { logTicketAction } = require('../modules/tickets');

module.exports = {
  name: 'close',
  description: 'Close a ticket (admin only)',
  async execute(message) {
    try {
      // Check if this is a ticket channel
      if (!message.channel.name.startsWith('ticket-')) {
        return message.reply('❌ This command can only be used in ticket channels.');
      }

      // Check if user has admin/administrator permissions
      const adminRoleId = process.env.ADMIN_ROLE_ID;
      const isAdmin = message.member.permissions.has('Administrator') || (adminRoleId && message.member.roles.cache.has(adminRoleId));
      if (!isAdmin) {
        return message.reply('❌ Only admins can close tickets.');
      }

      const ticketsPath = path.join(__dirname, '../tickets.json');

      let ticketsFile = {};
      try {
        if (fs.existsSync(ticketsPath)) {
          const raw = fs.readFileSync(ticketsPath, 'utf8').trim();
          if (raw) ticketsFile = JSON.parse(raw);
        }
      } catch (err) {
        console.error('Failed to read tickets.json in close.js:', err.message);
      }

      const ticketEntry = Object.entries(ticketsFile).find(([, ticket]) => ticket.channelId === message.channel.id);
      if (ticketEntry) {
        const ticketData = ticketEntry[1];
        delete ticketsFile[ticketEntry[0]];
        try {
          fs.writeFileSync(ticketsPath, JSON.stringify(ticketsFile, null, 2));
        } catch (err) {
          console.error('Failed to write tickets.json in close.js:', err.message);
        }

        await logTicketAction(message.client, 'Closed', {
          ticketId: ticketData.ticketId,
          userId: ticketData.userId,
          channelName: message.channel.name,
          executor: message.author,
          channel: message.channel
        });

        if (ticketData.forumThreadId) {
          try {
            const thread = await message.guild.channels.fetch(ticketData.forumThreadId).catch(() => null);
            if (thread) {
              const { EmbedBuilder } = require('discord.js');
              await thread.send({
                embeds: [
                  new EmbedBuilder()
                    .setDescription(`🔒 **Closed:** This ticket has been closed by ${message.author}.`)
                    .setColor('#e74c3c')
                    .setTimestamp()
                ]
              });
              await thread.setLocked(true).catch(() => {});
              await thread.setArchived(true).catch(() => {});
            }
          } catch (err) {
            console.error('Failed to close forum thread from command:', err.message);
          }
        }
      }

      await message.reply('✅ Ticket closed and channel will be deleted in 5 seconds...');
      setTimeout(() => message.channel.delete().catch(() => {}), 5000);
    } catch (err) {
      console.error('Error executing close command:', err);
    }
  }
};
