module.exports = {
  name: 'deleteall',
  description: 'Delete all bot messages in the DM channel (only allowed for user 1500513638283345991 in DMs)',
  async execute(message, args) {
    const allowedUserId = '1500513638283345991';
    if (message.author.id !== allowedUserId) {
      return message.reply('❌ You are not authorized to run this command.');
    }

    if (message.guild) {
      return message.reply('❌ This command can only be used in DMs.');
    }

    const statusMsg = await message.channel.send('⏳ Deleting bot messages in this DM...');

    try {
      let deletedCount = 0;
      let fetched;
      let lastMessageId = null;

      do {
        const options = { limit: 100 };
        if (lastMessageId) {
          options.before = lastMessageId;
        }

        fetched = await message.channel.messages.fetch(options);
        if (fetched.size === 0) break;

        // Keep track of the oldest message ID in this batch to paginate back
        lastMessageId = fetched.lastKey();

        // Filter messages sent by the bot (except the status message itself)
        const botMessages = fetched.filter(msg => msg.author.id === message.client.user.id && msg.id !== statusMsg.id);

        for (const msg of botMessages.values()) {
          try {
            await msg.delete();
            deletedCount++;
            // Small delay to respect Discord rate limits
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (err) {
            console.error(`Failed to delete message ${msg.id}:`, err.message);
          }
        }
      } while (fetched.size >= 100);

      await statusMsg.edit(`✅ Successfully deleted ${deletedCount} bot messages in this DM.`);
      setTimeout(() => {
        statusMsg.delete().catch(() => {});
      }, 5000);

    } catch (err) {
      console.error('Error during DM message deletion:', err);
      await statusMsg.edit('❌ An error occurred while trying to delete messages.');
    }
  }
};
