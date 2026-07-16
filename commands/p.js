'use strict';

module.exports = {
  name: 'p',
  aliases: ['purge'],
  description: 'Purge a specified number of messages or all messages in the channel.',
  async execute(message, args) {
    try {
      // Check if member has permissions to manage messages
      const adminRoleId = process.env.ADMIN_ROLE_ID;
      const isAuthorized = message.member.permissions.has('ManageMessages') || 
                           message.member.permissions.has('Administrator') ||
                           (adminRoleId && message.member.roles.cache.has(adminRoleId));
                           
      if (!isAuthorized) {
        return message.reply('❌ You do not have permission to manage messages in this channel.');
      }

      const arg = args[0];
      if (!arg) {
        return message.reply('❌ Please specify a number or "all". Usage: `,p <number|all>`');
      }

      let amountToDelete;
      if (arg.toLowerCase() === 'all') {
        amountToDelete = Infinity;
      } else {
        const parsed = parseInt(arg, 10);
        if (isNaN(parsed) || parsed <= 0) {
          return message.reply('❌ Please specify a valid positive number or "all".');
        }
        amountToDelete = parsed;
      }

      // Delete the command message first to avoid counting it
      await message.delete().catch(() => {});

      let deletedCount = 0;
      let keepDeleting = true;

      while (deletedCount < amountToDelete && keepDeleting) {
        const fetchLimit = amountToDelete === Infinity ? 100 : Math.min(100, amountToDelete - deletedCount);
        const messages = await message.channel.messages.fetch({ limit: fetchLimit }).catch(() => null);

        if (!messages || messages.size === 0) {
          break;
        }

        // Try bulk delete (only messages under 14 days old)
        let bulkDeleted = null;
        try {
          bulkDeleted = await message.channel.bulkDelete(messages, true);
          deletedCount += bulkDeleted.size;
        } catch (err) {
          console.warn('Bulk delete partially failed or not supported:', err.message);
        }

        // Fallback to individual delete for remaining messages (older than 14 days)
        const remaining = bulkDeleted ? messages.filter(m => !bulkDeleted.has(m.id)) : messages;
        if (remaining.size > 0 && deletedCount < amountToDelete) {
          for (const msg of remaining.values()) {
            if (deletedCount >= amountToDelete) break;
            try {
              await msg.delete();
              deletedCount++;
              // Delay to protect against Discord API rate limits
              await new Promise(resolve => setTimeout(resolve, 300));
            } catch (err) {
              console.error(`Failed to delete message ${msg.id}:`, err.message);
              // Stop deleting if we get a permission or system failure
              keepDeleting = false;
              break;
            }
          }
        }

        // Prevent infinite loops if no messages could be deleted
        if ((!bulkDeleted || bulkDeleted.size === 0) && remaining.size === 0) {
          break;
        }
      }

      // Send a temporary success response that auto-deletes after 5 seconds
      const response = await message.channel.send(`✅ Successfully purged **${deletedCount}** messages.`);
      setTimeout(() => response.delete().catch(() => {}), 5000);
    } catch (err) {
      console.error('Error during message purging:', err);
    }
  }
};
