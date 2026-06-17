require('dotenv').config();

// Force IPv4 DNS resolution to avoid connectivity issues on some hosts
const dns = require('dns');
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');

const fs   = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Partials, ChannelType } = require('discord.js');

const { slashCommands }         = require('./modules/slashCommands');
const { logConfigPath }         = require('./utils/logConfig');
const { writeJsonFile }         = require('./utils/jsonUtils');

// ── Event handlers ────────────────────────────────────────────────────────────
const guildMemberAddHandler    = require('./handlers/guildMemberAdd');
const guildMemberUpdateHandler = require('./handlers/guildMemberUpdate');
const messageCreateHandler     = require('./handlers/messageCreate');
const voiceStateUpdateHandler  = require('./handlers/voiceStateUpdate');
const interactionCreateHandler = require('./handlers/interactionCreate');

// ── Config ────────────────────────────────────────────────────────────────────
const prefix             = process.env.PREFIX || '!';
const LOG_CATEGORY_ID    = '1505885380023418890';
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID || '1505164182767800411';

// ── Discord client ────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.GuildMember],
});

// ── Load prefix commands ──────────────────────────────────────────────────────
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
    const command = require(path.join(commandsPath, file));
    if (command?.name) client.commands.set(command.name, command);
  }
}

// ── Server stats updater (stub — implement or import your own logic) ──────────
async function updateServerStats() {
  // Placeholder: add server-stats channel update logic here if needed.
}

// ── Register event handlers ───────────────────────────────────────────────────
guildMemberAddHandler.register(client);
guildMemberUpdateHandler.register(client);
messageCreateHandler.register(client, client.commands, updateServerStats, prefix);
voiceStateUpdateHandler.register(client);
interactionCreateHandler.register(client);

// ── Ready event ───────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Register slash commands globally (clears per-guild duplicates)
  try {
    await client.application.commands.set(slashCommands);
    console.log('Successfully registered global slash commands!');
    for (const guild of client.guilds.cache.values()) {
      await guild.commands.set([]);
      console.log(`Cleared guild-specific commands for: ${guild.name}`);
    }
  } catch (err) {
    console.error('Error deploying slash commands:', err);
  }

  // Auto-setup log channels if not yet configured
  const { getLogConfig } = require('./utils/logConfig');
  const logCfg = getLogConfig();
  const allLogsExist = logCfg.messageLog && logCfg.voiceLog && logCfg.muteLog && logCfg.roleLog;

  if (!allLogsExist) {
    try {
      for (const guild of client.guilds.cache.values()) {
        const category = guild.channels.cache.get(LOG_CATEGORY_ID);
        if (!category) continue;

        await category.setName('📋 Server Logs').catch(() => {});

        // Delete any old channels in the log category
        const existing = guild.channels.cache.filter(c => c.parentId === LOG_CATEGORY_ID);
        for (const [, ch] of existing) await ch.delete('Auto log setup: rebuilding').catch(() => {});

        const everyoneId = guild.roles.everyone.id;
        const adminPerms = [
          { id: everyoneId,         deny:  ['ViewChannel'] },
          { id: guild.members.me.id, allow: ['ViewChannel', 'SendMessages', 'EmbedLinks', 'ReadMessageHistory'] },
        ];

        const msgLog   = await guild.channels.create({ name: '📝│message-log',  type: ChannelType.GuildText, parent: LOG_CATEGORY_ID, permissionOverwrites: adminPerms });
        const voiceLog = await guild.channels.create({ name: '🎙️│voice-log',    type: ChannelType.GuildText, parent: LOG_CATEGORY_ID, permissionOverwrites: adminPerms });
        const muteLog  = await guild.channels.create({ name: '🔇│mute-log',     type: ChannelType.GuildText, parent: LOG_CATEGORY_ID, permissionOverwrites: adminPerms });
        const roleLog  = await guild.channels.create({ name: '🎭│role-log',     type: ChannelType.GuildText, parent: LOG_CATEGORY_ID, permissionOverwrites: adminPerms });

        writeJsonFile(logConfigPath, { messageLog: msgLog.id, voiceLog: voiceLog.id, muteLog: muteLog.id, roleLog: roleLog.id });
        console.log(`[✅ Log Setup] Created log channels in ${guild.name}`);
        break;
      }
    } catch (err) {
      console.error('[Log Setup] Failed to auto-create log channels:', err.message);
    }
  } else {
    console.log('[✅ Log Setup] Log channels already configured, skipping auto-setup.');
  }
});

// ── Process signal handlers ───────────────────────────────────────────────────
process.once('SIGINT',  () => process.exit(0));
process.once('SIGTERM', () => process.exit(0));

// ── Optional YouTube WebSub module ────────────────────────────────────────────
try {
  const yt = require('./youtube');
  yt.init(client).catch(err => console.error('YouTube init error', err));
} catch (e) {
  console.warn('youtube module not available:', e.message);
}

// ── Login ─────────────────────────────────────────────────────────────────────
client.login(process.env.TOKEN);
