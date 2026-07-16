'use strict';

module.exports = {
  name: 'send',
  description: 'Sends a message in the channel as the bot (admin only).',
  async execute(message, args) {
    try {
      // Check authorization (Administrator permission or specified admin role)
      const adminRoleId = process.env.ADMIN_ROLE_ID;
      const isAuthorized = message.member.permissions.has('Administrator') || 
                           (adminRoleId && message.member.roles.cache.has(adminRoleId));
                           
      if (!isAuthorized) {
        return message.reply('❌ You do not have permission to make the bot send messages.');
      }

      const textToSend = args.join(' ');
      if (!textToSend.trim()) {
        return message.reply('❌ Please specify the message content to send. Usage: `,send <message>`');
      }

      // Delete the command trigger message to keep the channel clean
      await message.delete().catch(() => {});

      // Send the text as the bot
      await message.channel.send({ content: textToSend });
    } catch (err) {
      console.error('Error executing send command:', err);
    }
  }
};
