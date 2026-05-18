require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');

const channelId = process.argv[2];

if (!channelId) {
  console.error('Usage: node scripts/delete_channel_messages.js <channel-id>');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('clientReady', async () => {
  let deleted = 0;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${channelId} is not a text channel or could not be found.`);
    }

    while (true) {
      const messages = await channel.messages.fetch({ limit: 100 });
      if (messages.size === 0) break;

      for (const message of messages.values()) {
        await message.delete().catch(err => {
          console.error(`Failed to delete message ${message.id}: ${err.message}`);
        });
        deleted += 1;
      }

      console.log(`Deleted ${deleted} messages so far...`);
    }

    console.log(`Done. Deleted ${deleted} messages from channel ${channelId}.`);
  } catch (err) {
    console.error('Delete failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(process.env.TOKEN);
