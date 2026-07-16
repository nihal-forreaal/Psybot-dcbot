require('dotenv').config();

// Force IPv4 DNS resolution to avoid connectivity issues on some hosts
const dns = require('dns');
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');

// ── Configuration ────────────────────────────────────────────────────────────
const prefix = process.env.PREFIX || '!';

// ── Discord Client Initialization ─────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

// ── Dynamic Command Loader ───────────────────────────────────────────────────
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (command?.name) {
      client.commands.set(command.name, command);
      if (command.aliases && Array.isArray(command.aliases)) {
        for (const alias of command.aliases) {
          client.commands.set(alias, command);
        }
      }
      console.log(`[Commands] Loaded prefix command: ${command.name} (aliases: ${command.aliases ? command.aliases.join(', ') : 'none'})`);
    }
  }
}

// ── Event Registration ────────────────────────────────────────────────────────
const messageCreateHandler = require('./handlers/messageCreate');
const interactionCreateHandler = require('./handlers/interactionCreate');
const voiceStateUpdateHandler = require('./handlers/voiceStateUpdate');
const guildMemberAddHandler = require('./handlers/guildMemberAdd');
const guildMemberUpdateHandler = require('./handlers/guildMemberUpdate');

messageCreateHandler.register(client, client.commands, prefix);
interactionCreateHandler.register(client);
voiceStateUpdateHandler.register(client);
guildMemberAddHandler.register(client);
guildMemberUpdateHandler.register(client);

// ── Ready Event ───────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  const commandsToRegister = [
    {
      name: 'youtube',
      description: 'Gets the official Psybot YouTube channel link.'
    },
    {
      name: 'log',
      description: 'Query audit logs inside a specific logging channel.',
      options: [
        {
          name: 'voice',
          description: 'Query voice channel join, leave and move history.',
          type: 1,
          options: [
            { name: 'start', description: 'Start time (e.g. 10am, 2:30pm)', type: 3, required: true },
            { name: 'end', description: 'End time (e.g. 11am, 3pm)', type: 3, required: true },
            { name: 'date', description: 'Date in YYYY-MM-DD format (default: today)', type: 3, required: false },
            { name: 'page', description: 'Page number', type: 4, required: false }
          ]
        },
        {
          name: 'messages',
          description: 'Query deleted and edited message history.',
          type: 1,
          options: [
            { name: 'start', description: 'Start time (e.g. 10am, 2:30pm)', type: 3, required: true },
            { name: 'end', description: 'End time (e.g. 11am, 3pm)', type: 3, required: true },
            { name: 'date', description: 'Date in YYYY-MM-DD format (default: today)', type: 3, required: false },
            { name: 'page', description: 'Page number', type: 4, required: false }
          ]
        },
        {
          name: 'mute',
          description: 'Query server or self mute and deafen history.',
          type: 1,
          options: [
            { name: 'start', description: 'Start time (e.g. 10am, 2:30pm)', type: 3, required: true },
            { name: 'end', description: 'End time (e.g. 11am, 3pm)', type: 3, required: true },
            { name: 'date', description: 'Date in YYYY-MM-DD format (default: today)', type: 3, required: false },
            { name: 'page', description: 'Page number', type: 4, required: false }
          ]
        },
        {
          name: 'role',
          description: 'Query role changes history.',
          type: 1,
          options: [
            { name: 'start', description: 'Start time (e.g. 10am, 2:30pm)', type: 3, required: true },
            { name: 'end', description: 'End time (e.g. 11am, 3pm)', type: 3, required: true },
            { name: 'date', description: 'Date in YYYY-MM-DD format (default: today)', type: 3, required: false },
            { name: 'page', description: 'Page number', type: 4, required: false }
          ]
        }
      ]
    },
    {
      name: 'stats',
      description: 'Shows server statistics',
    }
  ];

  // Register global slash commands (including /stats)
  try {
    await client.application.commands.set(commandsToRegister);
    console.log('[Slash Commands] Successfully registered global commands (youtube, log, stats).');
  } catch (err) {
    console.error('[Slash Commands] Error registering global commands:', err);
  }

  // Register guild-specific commands for immediate availability
  for (const guild of client.guilds.cache.values()) {
    try {
      await guild.commands.set(commandsToRegister);
      console.log(`[Slash Commands] Registered /youtube and /log for guild: ${guild.name}`);
    } catch (err) {
      console.warn(`[Slash Commands] Could not register commands for guild ${guild.name}:`, err.message);
    }
  }

  // Rename LOG category and its channels to matching premium gaming style names
  try {
    const categoryId = '1505885380023418890';
    const category = await client.channels.fetch(categoryId).catch(() => null);
    if (category) {
      // 1. Rename category itself
      if (category.name !== '╔ 📂 𝐒𝐄𝐑𝐕𝐄𝐑 𝐋𝐎𝐆𝐒 📂 ╗') {
        await category.setName('╔ 📂 𝐒𝐄𝐑𝐕𝐄𝐑 𝐋𝐎𝐆𝐒 📂 ╗').catch(() => {});
        console.log('[Channels] Successfully renamed LOG category to ╔ 📂 𝐒𝐄𝐑𝐕𝐄𝐑 𝐋𝐎𝐆𝐒 📂 ╗');
      }

      // 2. Fetch and rename channels inside
      const channels = category.guild.channels.cache.filter(c => c.parentId === categoryId);
      
      const channelMappings = {
        '1512013680018067537': '📝│message-logs',
        '1512013682635444285': '🎭│role-logs',
        '1512013682002104340': '🔇│moderation-logs',
        '1512013680987078696': '🎙️│voice-logs'
      };

      for (const [id, targetName] of Object.entries(channelMappings)) {
        const chan = channels.get(id);
        if (chan) {
          if (chan.name !== targetName) {
            await chan.setName(targetName).catch(() => {});
            console.log(`[Channels] Successfully renamed channel ${id} to ${targetName}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Channels] Failed to rename LOG category or channels:', err.message);
  }

  // Delete the old ticket-logs channel if it exists
  try {
    const oldLogChannel = await client.channels.fetch('1527448126477303848').catch(() => null);
    if (oldLogChannel) {
      await oldLogChannel.delete('Cleanup old ticket logs channel').catch(() => {});
      console.log('[Channels] Successfully deleted old ticket logs channel 1527448126477303848');
    }
  } catch (err) {
    console.warn('[Channels] Old ticket log channel already deleted or not found:', err.message);
  }

  // Rename forum channel to a premium styled name
  try {
    const forumChannel = await client.channels.fetch('1527452447084118127').catch(() => null);
    if (forumChannel) {
      if (forumChannel.name !== '📂│ticket-logs') {
        await forumChannel.setName('📂│ticket-logs').catch(() => {});
        console.log('[Channels] Successfully renamed forum channel to 📂│ticket-logs');
      }
    }
  } catch (err) {
    console.error('[Channels] Failed to rename forum channel:', err.message);
  }
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
process.once('SIGINT', () => process.exit(0));
process.once('SIGTERM', () => process.exit(0));

// ── Login ─────────────────────────────────────────────────────────────────────
client.login(process.env.TOKEN);
