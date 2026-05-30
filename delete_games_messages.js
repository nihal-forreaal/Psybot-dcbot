const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});

const channelId = '1506009762901524661';

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      console.error('Channel not found or not text-based');
      process.exit(1);
    }
    console.log(`Found channel: ${channel.name}. Starting deletion...`);
    let totalDeleted = 0;
    
    while (true) {
      const messages = await channel.messages.fetch({ limit: 100 });
      if (messages.size === 0) {
        break;
      }
      console.log(`Fetched ${messages.size} messages.`);
      
      // Try to bulkDelete first (only works for messages <= 14 days old)
      let bulkDeleted = null;
      try {
        bulkDeleted = await channel.bulkDelete(messages, true);
        totalDeleted += bulkDeleted.size;
        console.log(`Bulk deleted ${bulkDeleted.size} messages.`);
      } catch (err) {
        console.log(`Bulk delete failed: ${err.message}. Will try individual deletion.`);
      }

      // Find messages that weren't bulk-deleted
      const remainingMessages = bulkDeleted 
        ? messages.filter(m => !bulkDeleted.has(m.id))
        : messages;

      if (remainingMessages.size === 0) {
        continue;
      }

      console.log(`Deleting ${remainingMessages.size} remaining messages individually...`);
      let deletedInThisBatch = 0;
      for (const msg of remainingMessages.values()) {
        try {
          await msg.delete();
          totalDeleted++;
          deletedInThisBatch++;
          await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit buffer
        } catch (err) {
          console.error(`Failed to delete message ${msg.id}: ${err.message}`);
        }
      }

      // If we fetched messages and couldn't delete any, break to prevent infinite loop
      if (deletedInThisBatch === 0 && (!bulkDeleted || bulkDeleted.size === 0)) {
        console.log('Unable to delete any messages in this batch. Exiting.');
        break;
      }
    }
    console.log(`All done! Total messages deleted: ${totalDeleted}`);
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
});

client.login(process.env.TOKEN);
