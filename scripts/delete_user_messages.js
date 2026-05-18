require('dotenv').config();

const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const targetUserIds = process.argv.slice(2);

if (targetUserIds.length === 0) {
  console.error('Usage: node scripts/delete_user_messages.js <user-id> [user-id...]');
  process.exit(1);
}

const targets = new Set(targetUserIds);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

async function deleteFromChannel(channel) {
  const botMember = channel.guild.members.me;
  const permissions = channel.permissionsFor(botMember);

  if (!permissions?.has(PermissionsBitField.Flags.ViewChannel) ||
      !permissions?.has(PermissionsBitField.Flags.ReadMessageHistory) ||
      !permissions?.has(PermissionsBitField.Flags.ManageMessages)) {
    console.log(`Skipping #${channel.name}: missing permissions`);
    return 0;
  }

  let deleted = 0;
  let before;

  while (true) {
    const messages = await channel.messages.fetch({ limit: 100, before }).catch(err => {
      console.error(`Failed to fetch #${channel.name}: ${err.message}`);
      return null;
    });

    if (!messages || messages.size === 0) break;

    for (const message of messages.values()) {
      if (!targets.has(message.author.id)) continue;

      await message.delete().then(() => {
        deleted += 1;
      }).catch(err => {
        console.error(`Failed to delete ${message.id} in #${channel.name}: ${err.message}`);
      });
    }

    before = messages.last().id;
    console.log(`#${channel.name}: scanned ${messages.size}, deleted ${deleted}`);
  }

  return deleted;
}

client.once('clientReady', async () => {
  let totalDeleted = 0;

  try {
    for (const guild of client.guilds.cache.values()) {
      console.log(`Scanning ${guild.name}...`);
      const channels = await guild.channels.fetch();

      for (const channel of channels.values()) {
        if (!channel || !channel.isTextBased() || !channel.messages) continue;
        totalDeleted += await deleteFromChannel(channel);
      }
    }

    console.log(`Done. Deleted ${totalDeleted} messages from users: ${targetUserIds.join(', ')}`);
  } catch (err) {
    console.error('Delete failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(process.env.TOKEN);
