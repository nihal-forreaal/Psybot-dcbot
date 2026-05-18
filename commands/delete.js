module.exports = {
  name: 'delete',
  description: 'Deletes a specified number of messages or all messages in the channel (restricted)',
  async execute(message, args) {
    // Restrict only to user 1105072573580062790
    if (message.author.id !== '1105072573580062790') {
      return message.reply('❌ You do not have permission to use this command.');
    }

    const arg = args[0];
    if (!arg) {
      return message.reply('❌ Please specify a number or "all". Usage: `!delete <number|all>`');
    }

    let amountToDelete;
    if (arg.toLowerCase() === 'all') {
      amountToDelete = Infinity;
    } else {
      const parsed = parseInt(arg);
      if (isNaN(parsed) || parsed <= 0) {
        return message.reply('❌ Please specify a valid positive number or "all".');
      }
      amountToDelete = parsed;
    }

    // Delete the command message first
    await message.delete().catch(() => {});

    let deletedCount = 0;
    let before = null;
    let keepDeleting = true;

    while (deletedCount < amountToDelete && keepDeleting) {
      const fetchLimit = amountToDelete === Infinity ? 100 : Math.min(100, amountToDelete - deletedCount);
      const messages = await message.channel.messages.fetch({ limit: fetchLimit, before }).catch(err => {
        console.error('Fetch failed:', err.message);
        return null;
      });

      if (!messages || messages.size === 0) {
        break;
      }

      for (const msg of messages.values()) {
        try {
          await msg.delete();
          deletedCount++;
        } catch (err) {
          console.error(`Failed to delete message ${msg.id}: ${err.message}`);
          // Skip if deletion failed (e.g. system message or missing permission for specific message)
        }
      }

      if (messages.size > 0) {
        before = messages.last().id;
      } else {
        keepDeleting = false;
      }
    }

    // Send a temporary success response that auto-deletes after 5 seconds
    const response = await message.channel.send(`✅ Successfully deleted **${deletedCount}** messages.`);
    setTimeout(() => response.delete().catch(() => {}), 5000);
  }
};
