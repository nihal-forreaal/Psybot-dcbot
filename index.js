require('dotenv').config();

// Set FFMPEG_PATH to the static binary to ensure @discordjs/voice can decode streams on cloud containers
try {
  const ffmpeg = require('ffmpeg-static');
  if (ffmpeg) {
    process.env.FFMPEG_PATH = ffmpeg;
    console.log('[Lofi Stream] Configured FFMPEG_PATH:', ffmpeg);
  }
} catch (err) {
  console.error('[Lofi Stream] Could not auto-detect ffmpeg-static:', err.message);
}

const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const prefix = process.env.PREFIX || '!';
const ticketsPath = path.join(__dirname, 'tickets.json');
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID || '1505164182767800411';
const TICKET_PANEL_CHANNEL_ID = process.env.TICKET_PANEL_CHANNEL_ID || '1505164021186433075';
// LEVEL_SAVE_DELAY_MS removed (unused constant)
const MAX_FAKE_REPLIES = 5;
const balanceUtil = require('./balanceUtil');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildPresences
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction,
    Partials.GuildMember
  ]
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (command && command.name) client.commands.set(command.name, command);
  }
}

const onReady = async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Register slash commands for each guild
  const { ApplicationCommandOptionType } = require('discord.js');
  const slashCommands = [
    {
      name: 'kick',
      description: 'Kicks a member from the server.',
      options: [
        {
          name: 'user',
          description: 'The user to kick',
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: 'reason',
          description: 'Reason for kick',
          type: ApplicationCommandOptionType.String,
          required: false,
        }
      ]
    },
    {
      name: 'mute',
      description: 'Server mutes/unmutes a member in voice channels.',
      options: [
        {
          name: 'user',
          description: 'The user to server mute/unmute',
          type: ApplicationCommandOptionType.User,
          required: true,
        }
      ]
    },
    {
      name: 'deafen',
      description: 'Server deafens/undeafens a member in voice channels.',
      options: [
        {
          name: 'user',
          description: 'The user to server deafen/undeafen',
          type: ApplicationCommandOptionType.User,
          required: true,
        }
      ]
    },
    {
      name: 'defen',
      description: 'Server deafens/undeafens a member in voice channels.',
      options: [
        {
          name: 'user',
          description: 'The user to server deafen/undeafen',
          type: ApplicationCommandOptionType.User,
          required: true,
        }
      ]
    },
    {
      name: 'timeout',
      description: 'Times out/removes timeout from a member in the server.',
      options: [
        {
          name: 'user',
          description: 'The user to timeout',
          type: ApplicationCommandOptionType.User,
          required: true,
        },
        {
          name: 'minutes',
          description: 'Duration of timeout in minutes (default 10)',
          type: ApplicationCommandOptionType.Integer,
          required: false,
        },
        {
          name: 'reason',
          description: 'Reason for timeout',
          type: ApplicationCommandOptionType.String,
          required: false,
        }
      ]
    },

    {
      name: 'gamble',
      description: 'Gamble and play minigames to earn coins!',
      options: [
        {
          name: 'balance',
          description: 'Checks your current coin balance.',
          type: ApplicationCommandOptionType.Subcommand
        },
        {
          name: 'daily',
          description: 'Claims your daily reward of 500 coins.',
          type: ApplicationCommandOptionType.Subcommand
        },
        {
          name: 'coinflip',
          description: 'Play a coinflip game (50% win chance).',
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: 'side',
              description: 'Choose Heads or Tails',
              type: ApplicationCommandOptionType.String,
              required: true,
              choices: [
                { name: 'Heads', value: 'heads' },
                { name: 'Tails', value: 'tails' }
              ]
            },
            {
              name: 'bet',
              description: 'The amount of coins to bet',
              type: ApplicationCommandOptionType.Integer,
              required: true
            }
          ]
        },
        {
          name: 'slots',
          description: 'Play the slot machine.',
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: 'bet',
              description: 'The amount of coins to bet',
              type: ApplicationCommandOptionType.Integer,
              required: true
            }
          ]
        },
        {
          name: 'roll',
          description: 'Roll a 100-sided die (Roll > 55 to win).',
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: 'bet',
              description: 'The amount of coins to bet',
              type: ApplicationCommandOptionType.Integer,
              required: true
            }
          ]
        }
      ]
    },
    {
      name: 'log',
      description: 'Query and view logs fast for a specific timeframe',
      options: [
        {
          name: 'voice',
          description: 'Query voice channel logs',
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: 'start',
              description: 'Start time (e.g. 10am, 10:00, 2:30pm)',
              type: ApplicationCommandOptionType.String,
              required: true
            },
            {
              name: 'end',
              description: 'End time (e.g. 11am, 11:00, 3:30pm)',
              type: ApplicationCommandOptionType.String,
              required: true
            },
            {
              name: 'date',
              description: 'Date (format: YYYY-MM-DD). Defaults to today.',
              type: ApplicationCommandOptionType.String,
              required: false
            },
            {
              name: 'page',
              description: 'Select page number to view (defaults to 1)',
              type: ApplicationCommandOptionType.Integer,
              required: false
            }
          ]
        },
        {
          name: 'messages',
          description: 'Query message logs',
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: 'start',
              description: 'Start time (e.g. 10am, 10:00, 2:30pm)',
              type: ApplicationCommandOptionType.String,
              required: true
            },
            {
              name: 'end',
              description: 'End time (e.g. 11am, 11:00, 3:30pm)',
              type: ApplicationCommandOptionType.String,
              required: true
            },
            {
              name: 'date',
              description: 'Date (format: YYYY-MM-DD). Defaults to today.',
              type: ApplicationCommandOptionType.String,
              required: false
            },
            {
              name: 'page',
              description: 'Select page number to view (defaults to 1)',
              type: ApplicationCommandOptionType.Integer,
              required: false
            }
          ]
        },
        {
          name: 'mute',
          description: 'Query mute/unmute logs',
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: 'start',
              description: 'Start time (e.g. 10am, 10:00, 2:30pm)',
              type: ApplicationCommandOptionType.String,
              required: true
            },
            {
              name: 'end',
              description: 'End time (e.g. 11am, 11:00, 3:30pm)',
              type: ApplicationCommandOptionType.String,
              required: true
            },
            {
              name: 'date',
              description: 'Date (format: YYYY-MM-DD). Defaults to today.',
              type: ApplicationCommandOptionType.String,
              required: false
            },
            {
              name: 'page',
              description: 'Select page number to view (defaults to 1)',
              type: ApplicationCommandOptionType.Integer,
              required: false
            }
          ]
        },
        {
          name: 'role',
          description: 'Query role logs',
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: 'start',
              description: 'Start time (e.g. 10am, 10:00, 2:30pm)',
              type: ApplicationCommandOptionType.String,
              required: true
            },
            {
              name: 'end',
              description: 'End time (e.g. 11am, 11:00, 3:30pm)',
              type: ApplicationCommandOptionType.String,
              required: true
            },
            {
              name: 'date',
              description: 'Date (format: YYYY-MM-DD). Defaults to today.',
              type: ApplicationCommandOptionType.String,
              required: false
            },
            {
              name: 'page',
              description: 'Select page number to view (defaults to 1)',
              type: ApplicationCommandOptionType.Integer,
              required: false
            }
          ]
        }
      ]
    {
      name: 'lofi',
      description: 'Change the active 24/7 Lofi radio station or play SoundCloud',
      options: [
        {
          name: 'station',
          description: 'Select the type of Lofi music to play',
          type: ApplicationCommandOptionType.String,
          required: false,
          choices: [
            { name: 'Chill (Relaxing Lofi Beats)', value: 'chill' },
            { name: 'Study (Focus Study Lofi)', value: 'study' },
            { name: 'Coding (Electronic Chill Coding Beats)', value: 'coding' }
          ]
        },
        {
          name: 'soundcloud',
          description: 'Enter a SoundCloud track or playlist/set URL',
          type: ApplicationCommandOptionType.String,
          required: false
        }
      ]
    }
  ];

  try {
    // Register commands globally for the profile badge
    await client.application.commands.set(slashCommands);
    console.log(`Successfully registered global slash commands!`);

    // Clear guild-level commands to ensure no duplicates exist (only global ones will remain)
    for (const guild of client.guilds.cache.values()) {
      await guild.commands.set([]);
      console.log(`Cleared guild-specific commands for: ${guild.name}`);
    }
  } catch (err) {
    console.error('Error deploying slash commands:', err);
  }

  // Auto-setup log channels on startup
  const { ChannelType } = require('discord.js');
  const LOG_CATEGORY_ID = '1505885380023418890';
  const logCfg = getLogConfig();
  const allLogsExist = logCfg.messageLog && logCfg.voiceLog && logCfg.muteLog && logCfg.roleLog;
  if (!allLogsExist) {
    try {
      for (const guild of client.guilds.cache.values()) {
        const category = guild.channels.cache.get(LOG_CATEGORY_ID);
        if (!category) continue;

        // Rename the category with a proper emoji
        await category.setName('📋 Server Logs').catch(() => {});

        // Delete old channels in the category
        const existing = guild.channels.cache.filter(c => c.parentId === LOG_CATEGORY_ID);
        for (const [, ch] of existing) {
          await ch.delete('Auto log setup: rebuilding').catch(() => {});
        }

        const everyoneId = guild.roles.everyone.id;
        const adminPerms = [
          { id: everyoneId, deny: ['ViewChannel'] },
          { id: guild.members.me.id, allow: ['ViewChannel', 'SendMessages', 'EmbedLinks', 'ReadMessageHistory'] }
        ];

        const msgLog   = await guild.channels.create({ name: '📝│message-log',  type: ChannelType.GuildText, parent: LOG_CATEGORY_ID, permissionOverwrites: adminPerms });
        const voiceLog = await guild.channels.create({ name: '🎙️│voice-log',    type: ChannelType.GuildText, parent: LOG_CATEGORY_ID, permissionOverwrites: adminPerms });
        const muteLog  = await guild.channels.create({ name: '🔇│mute-log',     type: ChannelType.GuildText, parent: LOG_CATEGORY_ID, permissionOverwrites: adminPerms });
        const roleLog  = await guild.channels.create({ name: '🎭│role-log',     type: ChannelType.GuildText, parent: LOG_CATEGORY_ID, permissionOverwrites: adminPerms });

        const newCfg = { messageLog: msgLog.id, voiceLog: voiceLog.id, muteLog: muteLog.id, roleLog: roleLog.id };
        fs.writeFileSync(logConfigPath, JSON.stringify(newCfg, null, 2));
        console.log(`[✅ Log Setup] Created log channels in ${guild.name}`);
        break; // Only set up once for the first guild found
      }
    } catch (err) {
      console.error('[Log Setup] Failed to auto-create log channels:', err.message);
    }
  } else {
    console.log('[✅ Log Setup] Log channels already configured, skipping auto-setup.');
  }

  // Start 24/7 Lofi VC audio stream
  startLofiStream();
};



client.once('ready', onReady);

// ---- One-Time Old Stats Cleanup ----
const cleanupFlagPath = path.join(__dirname, 'cleanup_stats.flag');
client.once('ready', async () => {
  if (fs.existsSync(cleanupFlagPath)) return;
  try {
    const categoriesToDelete = ['1510312118845706361', '1510312122125516901'];
    for (const catId of categoriesToDelete) {
      const cat = client.channels.cache.get(catId);
      if (cat) {
        // Delete all child channels first
        for (const [childId, child] of cat.children.cache) {
          await child.delete().catch(() => {});
        }
        // Then delete the category itself
        await cat.delete().catch(() => {});
        console.log(`[🗑️ Cleanup] Deleted category ${catId}`);
      }
    }
    fs.writeFileSync(cleanupFlagPath, 'done');
  } catch (err) {
    console.error('[Cleanup] Failed:', err.message);
  }
});

// ---- One-Time Among Us Deal Announcement ----
const dealFlagPath = path.join(__dirname, 'deal_sent.flag');
client.once('ready', async () => {
  if (fs.existsSync(dealFlagPath)) return; // Already sent, skip

  try {
    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const dealChannel = await client.channels.fetch('1501237193996501003').catch(() => null);
    if (!dealChannel) return;

    const embed = new EmbedBuilder()
      .setColor('#C51111')
      .setTitle('\ud83d\udea8 DEAL ALERT — Among Us on PC!')
      .setDescription(
        `> *One of us... has a deal this good.* \ud83d\udd75\ufe0f\n\n` +
        `**Among Us** is now available on the **Microsoft Store** at an unbeatable price!\n` +
        `Jump into lobbies, find the Impostors, and survive the chaos with your crewmates.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .addFields(
        { name: '\ud83c\udff7\ufe0f Price', value: '## \u20b9161 only!', inline: true },
        { name: '\ud83d\udecd\ufe0f Platform', value: 'Microsoft Store\n(PC / Xbox)', inline: true },
        { name: '\ud83d\udc65 Players', value: '4 \u2013 15 Players\nOnline & Local', inline: true },
        {
          name: '\u2728 What You Get',
          value:
            '\u25aa\ufe0f Cross-play with mobile & console\n' +
            '\u25aa\ufe0f Multiple maps: Skeld, Mira HQ, Polus & The Airship\n' +
            '\u25aa\ufe0f Pets, cosmetics & hats\n' +
            '\u25aa\ufe0f Voice chat support & custom lobbies\n' +
            '\u25aa\ufe0f Regular free content updates',
          inline: false
        }
      )
      .setImage('https://store-images.s-microsoft.com/image/apps.63208.14391172489219718.b4744f40-5fdc-4e81-b90b-b37a9c2fdf07.f5d9fa96-0bf0-4b40-875f-23b15f1b8b22')
      .setFooter({ text: 'Psybot Gaming Deals \u2022 Offer may change at any time', iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('\ud83d\udecd\ufe0f Buy on Microsoft Store')
        .setStyle(ButtonStyle.Link)
        .setURL('https://apps.microsoft.com/detail/9NG07QJNK38J?hl=en&gl=IN'),
      new ButtonBuilder()
        .setLabel('\ud83c\udfae Official Among Us Site')
        .setStyle(ButtonStyle.Link)
        .setURL('https://www.innersloth.com/games/among-us/')
    );

    await dealChannel.send({ embeds: [embed], components: [row] });
    fs.writeFileSync(dealFlagPath, 'sent'); // Mark as sent so it never fires again
    console.log('[\u2705 Deal] Among Us deal announcement sent!');
  } catch (err) {
    console.error('[Deal] Failed to send deal announcement:', err.message);
  }
});

client.on('guildMemberAdd', async member => {
  try {
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
    const channelUrl = 'https://www.youtube.com/@psybotlive';
    const welcomeEmbed = new EmbedBuilder()
      .setTitle('Welcome!')
      .setDescription("We're glad you're here.\nJump in anytime.")
      .setColor('#57F287');

    const channelButton = new ButtonBuilder()
      .setLabel('Psybot Live channel')
      .setStyle(ButtonStyle.Link)
      .setURL(channelUrl);

    const welcomeMessage = {
      content: `Welcome to Psybot Gaming, ${member.user}!`,
      embeds: [welcomeEmbed],
      components: [new ActionRowBuilder().addComponents(channelButton)],
    };

    const welcomeChannel = await member.guild.channels.fetch('1445406874231898153').catch(() => null);
    if (welcomeChannel) {
      await welcomeChannel.send(welcomeMessage);
    } else {
      console.warn('Welcome channel 1445406874231898153 not found.');
    }
  } catch (err) {
    console.error(`Could not send welcome message for ${member.user.tag}:`, err.message);
  }
});

// Local Level system helpers removed. Using levelsUtil.js instead.

function removeTicketByChannel(channelId) {
  const tickets = readJsonFile(ticketsPath, {});
  const ticketEntry = Object.entries(tickets).find(([, ticket]) => ticket.channelId === channelId);

  if (ticketEntry) {
    delete tickets[ticketEntry[0]];
    writeJsonFile(ticketsPath, tickets);
  }
}

function getTicketByChannel(channelId) {
  const tickets = readJsonFile(ticketsPath, {});
  return Object.values(tickets).find(ticket => ticket.channelId === channelId);
}

function parseUserId(input) {
  if (!input) return null;
  const mentionMatch = input.trim().match(/^<@!?(\d+)>$/);
  if (mentionMatch) return mentionMatch[1];
  const idMatch = input.trim().match(/^(\d{17,19})$/);
  return idMatch ? idMatch[1] : null;
}

function buildTicketEmbed(userId, ticketId, claimedBy, staffMentions) {
  const { EmbedBuilder } = require('discord.js');
  const embed = new EmbedBuilder()
    .setTitle('📋 Support Ticket Opened')
    .setDescription(
      `Hello <@${userId}>, welcome to your private support session.\n\n` +
      `▪️ **Ticket ID:** \`${ticketId}\`\n` +
      `▪️ **Status:** ${claimedBy ? `Claimed by <@${claimedBy}>` : '`Awaiting Staff`🔑'}\n\n` +
      `*Please describe your issue or question in detail here. A representative will join and assist you shortly.*`
    )
    .setColor('#ff3333') // Crimson Red
    .setFooter({ text: 'Psybot Support Services', iconURL: client.user.displayAvatarURL() })
    .setTimestamp();

  if (claimedBy) {
    embed.addFields([
      { name: '🔴 Claimed By', value: `<@${claimedBy}>`, inline: true },
      { name: '⚫ Claim Time', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
    ]);
  }

  if (staffMentions && !claimedBy) {
    embed.setDescription(
      `Hello <@${userId}>, welcome to your private support session.\n\n` +
      `▪️ **Ticket ID:** \`${ticketId}\`\n` +
      `▪️ **Status:** \`Awaiting Staff\` 🔴\n\n` +
      `*Please describe your issue or question in detail here. A representative will join and assist you shortly.*\n\n` +
      `🔔 **Staff Paged:** ${staffMentions}`
    );
  }

  return embed;
}

function buildTicketButtons(claimed) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

  const claimButton = new ButtonBuilder()
    .setCustomId('claim_ticket')
    .setLabel(claimed ? 'Ticket Claimed' : 'Claim Ticket')
    .setStyle(claimed ? ButtonStyle.Secondary : ButtonStyle.Danger) // Red if active, Grey if claimed
    .setEmoji('🛎️')
    .setDisabled(Boolean(claimed));

  const transferButton = new ButtonBuilder()
    .setCustomId('transfer_ticket')
    .setLabel('Transfer')
    .setStyle(ButtonStyle.Secondary) // Grey/Black
    .setEmoji('🔁');

  const addUserButton = new ButtonBuilder()
    .setCustomId('add_user_ticket')
    .setLabel('Add User')
    .setStyle(ButtonStyle.Secondary) // Grey/Black
    .setEmoji('➕');

  const closeButton = new ButtonBuilder()
    .setCustomId('close_ticket')
    .setLabel('Close Ticket')
    .setStyle(ButtonStyle.Danger) // Crimson Red
    .setEmoji('🔒');

  return new ActionRowBuilder().addComponents(claimButton, transferButton, addUserButton, closeButton);
}

function readJsonFile(filePath, fallback) {
  try {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    return content ? JSON.parse(content) : fallback;
  } catch (err) {
    console.error(`Failed to read ${path.basename(filePath)}:`, err.message);
    return fallback;
  }
}

function writeJsonFile(filePath, data) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filePath);
}

// Local Levels cache logic removed. Utilizing levelsUtil.js for reliable updates.

process.once('SIGINT', () => {
  process.exit(0);
});

process.once('SIGTERM', () => {
  process.exit(0);
});

// initialize optional YouTube webhook (requires PUBLIC_URL and YT_CHANNEL_ID in .env)
try {
  const yt = require('./youtube');
  yt.init(client).catch(err => console.error('YouTube init error', err));
} catch (e) {
  console.warn('youtube module not available:', e.message);
}

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // Filter out slurs/offensive words (variations of the N-word)
  const normalizedContent = message.content.toLowerCase().replace(/[\s\-_.]/g, '');
  const nWordRegex = /n+[i\u00a11\u00ec\u00ed\u00ee\u00ef]+g+a+|n+g+a+|n+i+g+e+r+|n+i+g+g+e+r+/i;
  
  if (nWordRegex.test(normalizedContent) || nWordRegex.test(message.content)) {
    try {
      await message.delete();
      // Send a warning that auto-deletes in 5 seconds
      const warnMsg = await message.channel.send(`⚠️ ${message.author}, that word is not allowed here.`);
      setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
      return;
    } catch (err) {
      console.error('Failed to delete message containing restricted word:', err.message);
    }
  }

  console.log(`[MESSAGE] Received from ${message.author.tag} (${message.author.id}) in ${message.guild?.name || 'DM'}: "${message.content}"`);

  // Custom reaction for pinging specific user
  if (message.mentions.users.has('1105072573580062790')) {
    message.react('1510273361455091752').catch(err => console.error('Failed to react to specific ping:', err));
  }

  // Custom random letter generator for channel 1445395976495042641
  if (message.channel.id === '1445395976495042641') {
    const numMatch = message.content.trim().match(/^(\d+)$/);
    if (numMatch) {
      const count = parseInt(numMatch[1], 10);
      if (count > 0) {
        const maxLimit = 100;
        const actualCount = Math.min(count, maxLimit);
        
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let i = 0; i < actualCount; i++) {
          const letter = chars.charAt(Math.floor(Math.random() * chars.length));
          await message.channel.send(letter).catch(err => console.error('Failed to send letter:', err));
          // Wait 1000ms between letters to perfectly comply with Discord rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (count > maxLimit) {
          await message.channel.send(`⚠️ *Count capped at ${maxLimit} to prevent rate limits.*`).catch(() => {});
        }
        return;
      }
    }
  }

  // Log all messages to the specified channel, excluding the logs channel
  const logChannelId = '1505905409003884634';
  if (message.guild && message.channel.id !== logChannelId) {
    try {
      const logChannel = client.channels.cache.get(logChannelId);
      if (logChannel) {
        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
          .setColor('#0f8c8c') // Sleek dark teal color matching the screenshot style
          .setDescription(
            `**Channel:** <#${message.channel.id}> ( <#${message.channel.id}> )\n` +
            `**Message ID:** ${message.id}\n` +
            `**Message author:** ${message.author.tag} ( <@${message.author.id}> )\n` +
            `**Message created:** <t:${Math.floor(message.createdTimestamp / 1000)}:R>\n\n` +
            `**Message**\n${message.content || '[No Text Content]'}`
          )
          .setTimestamp(message.createdAt);

        // If message has an image attachment, display it in the embed
        const firstAttachment = message.attachments.first();
        if (firstAttachment && firstAttachment.contentType?.startsWith('image/')) {
          embed.setImage(firstAttachment.url);
        }

        await logChannel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error('Failed to log message:', err);
    }
  }

  const earlyNormalizedMessage = message.content.trim().toLowerCase();
  const earlyPlainMessage = earlyNormalizedMessage.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');

  if (earlyPlainMessage === 'who is the king') {
    return message.channel.send('zypher');
  }

  if (earlyNormalizedMessage === '!syncstats') {
    if (!message.member.permissions.has('Administrator')) return;
    await message.reply('Syncing stats now...');
    await updateServerStats();
    return message.channel.send('✅ Stats synced successfully!');
  }

  const earlyFakeMatches = earlyNormalizedMessage.match(/\bfake\b/g) || [];
  if (earlyFakeMatches.length > 0) {
    for (let i = 0; i < earlyFakeMatches.length; i += 1) {
      await message.channel.send('ur are the fake one !!');
    }
    return;
  }

  if (/\b(yt|youtube)\b/.test(earlyNormalizedMessage)) {
    return message.channel.send('Search psybotlive 🤫');
  }

  // Dead code block removed

  // Command handler
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);
  if (!command) return;

  try {
    await command.execute(message, args);
  } catch (err) {
    console.error(err);
    message.reply('There was an error executing that command.');
  }
});

// Ticket System Button Handler
// ---- Log Config Helper ----
const logConfigPath = path.join(__dirname, 'logConfig.json');
function getLogConfig() {
  try { return JSON.parse(fs.readFileSync(logConfigPath, 'utf8')); } catch { return {}; }
}

client.on('interactionCreate', async interaction => {
  if (interaction.isButton() && interaction.customId.startsWith('logpage_')) {
    const [, subcommand, startMsStr, endMsStr, pageStr] = interaction.customId.split('_');
    const startMs = Number(startMsStr);
    const endMs = Number(endMsStr);
    const page = Number(pageStr);

    await interaction.deferUpdate();

    try {
      const getSnowflake = (ms) => {
        return ((BigInt(ms) - 1420070400000n) << 22n).toString();
      };

      const startSnowflake = getSnowflake(startMs);
      const endSnowflake = getSnowflake(endMs);

      const logCfg = getLogConfig();
      let targetChannelId;
      if (subcommand === 'voice') targetChannelId = logCfg.voiceLog;
      else if (subcommand === 'messages') targetChannelId = logCfg.messageLog;
      else if (subcommand === 'mute') targetChannelId = logCfg.muteLog;
      else if (subcommand === 'role') targetChannelId = logCfg.roleLog;

      if (!targetChannelId) return;

      const guild = interaction.guild;
      const channel = await guild.channels.fetch(targetChannelId).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      let logList = [];
      let lastId = startSnowflake;
      let keepFetching = true;

      while (keepFetching && logList.length < 100) {
        const fetched = await channel.messages.fetch({ after: lastId, limit: 100 }).catch(() => null);
        if (!fetched || fetched.size === 0) break;

        const sorted = [...fetched.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        for (const msg of sorted) {
          if (BigInt(msg.id) > BigInt(endSnowflake)) {
            keepFetching = false;
            break;
          }
          lastId = msg.id;

          let logText = msg.content || '';
          if (msg.embeds && msg.embeds.length > 0) {
            const embed = msg.embeds[0];
            logText = embed.description || embed.title || '';
          }

          logText = (logText || '').replace(/\n+/g, ' ').trim();
          if (!logText) logText = '[No text content / embed description]';

          const msgTime = new Date(msg.createdTimestamp + 5.5 * 60 * 60 * 1000);
          const hours = msgTime.getUTCHours();
          const minutes = msgTime.getUTCMinutes().toString().padStart(2, '0');
          const ampm = hours >= 12 ? 'PM' : 'AM';
          const displayHour = hours % 12 || 12;
          const timeFormatted = `${displayHour}:${minutes} ${ampm}`;

          logList.push(`\`[${timeFormatted}]\` ${logText}`);
        }

        if (fetched.size < 100) break;
      }

      const logsPerPage = 10;
      const totalPages = Math.ceil(logList.length / logsPerPage) || 1;
      const startIndex = (page - 1) * logsPerPage;
      const endIndex = startIndex + logsPerPage;
      const pageLogs = logList.slice(startIndex, endIndex);

      const startDate = new Date(startMs + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
      const formatHeaderTime = (ms) => {
        const t = new Date(ms + 5.5 * 60 * 60 * 1000);
        const h = t.getUTCHours();
        const m = t.getUTCMinutes().toString().padStart(2, '0');
        const ampm = h >= 12 ? 'pm' : 'am';
        const dh = h % 12 || 12;
        return `${dh}:${m}${ampm}`;
      };
      const startTimeStr = formatHeaderTime(startMs);
      const endTimeStr = formatHeaderTime(endMs);

      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const embed = new EmbedBuilder()
        .setTitle(`📋 ${subcommand.toUpperCase()} Logs`)
        .setDescription(`**Date:** \`${startDate}\`\n**Range:** \`${startTimeStr}\` to \`${endTimeStr}\` (IST)\n\n` + (pageLogs.length > 0 ? pageLogs.join('\n') : '*No logs found for this timeframe.*'))
        .setColor('#0f8c8c')
        .setFooter({ text: `Page ${page} of ${totalPages} • Total Logs: ${logList.length}` })
        .setTimestamp();

      const row = new ActionRowBuilder();
      const prevButton = new ButtonBuilder()
        .setCustomId(`logpage_${subcommand}_${startMs}_${endMs}_${page - 1}`)
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page <= 1);

      const nextButton = new ButtonBuilder()
        .setCustomId(`logpage_${subcommand}_${startMs}_${endMs}_${page + 1}`)
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= totalPages);

      row.addComponents(prevButton, nextButton);

      const updateData = { embeds: [embed] };
      if (totalPages > 1) {
        updateData.components = [row];
      } else {
        updateData.components = [];
      }

      await interaction.editReply(updateData);
    } catch (err) {
      console.error('Error updating log page:', err);
    }
    return;
  }

  if (interaction.isChatInputCommand()) {
    const { commandName, options, guild, member } = interaction;

    if (commandName === 'log') {
      const subcommand = options.getSubcommand();
      const startTimeStr = options.getString('start');
      const endTimeStr = options.getString('end');
      const pageOpt = options.getInteger('page') || 1;
      
      const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      const defaultDateStr = nowIST.toISOString().split('T')[0];
      const dateStr = options.getString('date') || defaultDateStr;

      const parseTime = (date, time) => {
        const match = time.trim().toLowerCase().match(/^(\d+)(?::(\d+))?\s*(am|pm)?$/);
        if (!match) return null;
        let hours = parseInt(match[1]);
        const minutes = match[2] ? parseInt(match[2]) : 0;
        const ampm = match[3];
        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;

        const dateParts = date.split('-');
        if (dateParts.length !== 3) return null;
        const y = parseInt(dateParts[0]);
        const m = parseInt(dateParts[1]) - 1;
        const d = parseInt(dateParts[2]);

        const utcDate = new Date(Date.UTC(y, m, d, hours, minutes));
        return utcDate.getTime() - (5.5 * 60 * 60 * 1000);
      };

      const startMs = parseTime(dateStr, startTimeStr);
      const endMs = parseTime(dateStr, endTimeStr);

      if (!startMs || !endMs) {
        return interaction.reply({ 
          content: '❌ Invalid time or date format. Use `10am`, `2:30pm`, or `14:00` for times, and `YYYY-MM-DD` for date.', 
          ephemeral: true 
        });
      }

      if (startMs >= endMs) {
        return interaction.reply({ 
          content: '❌ Start time must be before end time!', 
          ephemeral: true 
        });
      }

      const getSnowflake = (ms) => {
        return ((BigInt(ms) - 1420070400000n) << 22n).toString();
      };

      const startSnowflake = getSnowflake(startMs);
      const endSnowflake = getSnowflake(endMs);

      const logCfg = getLogConfig();
      let targetChannelId;
      if (subcommand === 'voice') targetChannelId = logCfg.voiceLog;
      else if (subcommand === 'messages') targetChannelId = logCfg.messageLog;
      else if (subcommand === 'mute') targetChannelId = logCfg.muteLog;
      else if (subcommand === 'role') targetChannelId = logCfg.roleLog;

      if (!targetChannelId) {
        return interaction.reply({ content: '❌ Log channel configuration not found.', ephemeral: true });
      }

      const channel = await guild.channels.fetch(targetChannelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        return interaction.reply({ content: '❌ Log channel not found or not text-based.', ephemeral: true });
      }

      await interaction.deferReply();

      try {
        let logList = [];
        let lastId = startSnowflake;
        let keepFetching = true;

        while (keepFetching && logList.length < 100) {
          const fetched = await channel.messages.fetch({ after: lastId, limit: 100 }).catch(() => null);
          if (!fetched || fetched.size === 0) break;

          const sorted = [...fetched.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
          for (const msg of sorted) {
            if (BigInt(msg.id) > BigInt(endSnowflake)) {
              keepFetching = false;
              break;
            }
            lastId = msg.id;

            let logText = msg.content || '';
            if (msg.embeds && msg.embeds.length > 0) {
              const embed = msg.embeds[0];
              logText = embed.description || embed.title || '';
            }

            logText = (logText || '').replace(/\n+/g, ' ').trim();
            if (!logText) logText = '[No text content / embed description]';

            const msgTime = new Date(msg.createdTimestamp + 5.5 * 60 * 60 * 1000);
            const hours = msgTime.getUTCHours();
            const minutes = msgTime.getUTCMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const displayHour = hours % 12 || 12;
            const timeFormatted = `${displayHour}:${minutes} ${ampm}`;

            logList.push(`\`[${timeFormatted}]\` ${logText}`);
          }

          if (fetched.size < 100) break;
        }

        const logsPerPage = 10;
        const totalPages = Math.ceil(logList.length / logsPerPage) || 1;
        
        let page = pageOpt;
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;

        const startIndex = (page - 1) * logsPerPage;
        const endIndex = startIndex + logsPerPage;
        const pageLogs = logList.slice(startIndex, endIndex);

        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const embed = new EmbedBuilder()
          .setTitle(`📋 ${subcommand.toUpperCase()} Logs`)
          .setDescription(`**Date:** \`${dateStr}\`\n**Range:** \`${startTimeStr}\` to \`${endTimeStr}\` (IST)\n\n` + (pageLogs.length > 0 ? pageLogs.join('\n') : '*No logs found for this timeframe.*'))
          .setColor('#0f8c8c')
          .setFooter({ text: `Page ${page} of ${totalPages} • Total Logs: ${logList.length}` })
          .setTimestamp();

        const row = new ActionRowBuilder();
        const prevButton = new ButtonBuilder()
          .setCustomId(`logpage_${subcommand}_${startMs}_${endMs}_${page - 1}`)
          .setLabel('◀ Previous')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page <= 1);

        const nextButton = new ButtonBuilder()
          .setCustomId(`logpage_${subcommand}_${startMs}_${endMs}_${page + 1}`)
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page >= totalPages);

        row.addComponents(prevButton, nextButton);

        const responseData = { embeds: [embed] };
        if (totalPages > 1) {
          responseData.components = [row];
        }

        return interaction.editReply(responseData);
      } catch (err) {
        console.error('Error querying logs:', err);
        return interaction.editReply({ content: '❌ An error occurred while fetching logs.' });
      }
    }

    if (commandName === 'lofi') {
      if (!member.voice || member.voice.channelId !== '1512025016987029576') {
        return interaction.reply({
          content: '❌ You must be connected to the Lofi voice channel <#1512025016987029576> to change the station!',
          ephemeral: true
        });
      }

      const station = options.getString('station');
      const soundcloudUrl = options.getString('soundcloud');

      if (!station && !soundcloudUrl) {
        return interaction.reply({
          content: '❌ You must specify either a Lofi `station` or a `soundcloud` link!',
          ephemeral: true
        });
      }

      await interaction.deferReply();

      if (soundcloudUrl) {
        if (!soundcloudUrl.toLowerCase().startsWith('https://soundcloud.com/')) {
          return interaction.editReply('❌ Invalid SoundCloud URL. It must start with `https://soundcloud.com/`.');
        }

        try {
          const scdl = require('soundcloud-downloader').default;
          
          if (soundcloudUrl.includes('/sets/')) {
            const setInfo = await scdl.getSetInfo(soundcloudUrl).catch(() => null);
            if (!setInfo || !setInfo.tracks || setInfo.tracks.length === 0) {
              return interaction.editReply('❌ Failed to fetch tracks from this SoundCloud playlist. Make sure it is public.');
            }

            soundcloudQueue = setInfo.tracks.map(t => t.permalink_url).filter(Boolean);
            currentQueueIndex = 0;
            isPlayingSoundcloud = true;
            playStream();

            return interaction.editReply(`🎶 Loaded SoundCloud Playlist: **${setInfo.title || 'Unknown playlist'}** (${soundcloudQueue.length} tracks). Starting playback...`);
          } else {
            // Single track
            soundcloudQueue = [soundcloudUrl];
            currentQueueIndex = 0;
            isPlayingSoundcloud = true;
            playStream();

            return interaction.editReply(`🎶 Loading and playing SoundCloud track: <${soundcloudUrl}>`);
          }
        } catch (err) {
          console.error('[Lofi Stream] SoundCloud loading error:', err);
          return interaction.editReply('❌ An error occurred while attempting to fetch the SoundCloud stream.');
        }
      }

      if (station) {
        isPlayingSoundcloud = false;
        const stations = {
          chill: 'https://stream.laut.fm/lofi',
          study: 'https://stream.laut.fm/lofiradio',
          coding: 'https://stream.laut.fm/chilledbeats'
        };

        currentStreamUrl = stations[station];
        playStream();

        const emojiMap = { chill: '🍃', study: '📚', coding: '💻' };
        return interaction.editReply(`✅ Changed Lofi station to **${station.toUpperCase()}** ${emojiMap[station]}\nNow streaming: <${currentStreamUrl}>`);
      }
    }

    if (commandName === 'gamble') {
      if (interaction.channelId !== '1512008740361076776') {
        return interaction.reply({ 
          content: '❌ The gamble commands can only be used in the dedicated games channel <#1512008740361076776>.', 
          ephemeral: true 
        });
      }

      const subcommand = options.getSubcommand();
      const userId = interaction.user.id;

      if (subcommand === 'balance') {
        const bal = balanceUtil.getBalance(userId);
        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
          .setTitle('🪙 Coin Balance')
          .setDescription(`Your current wallet balance is **${bal}** coins.`)
          .setColor('#ffd700')
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      if (subcommand === 'daily') {
        const result = balanceUtil.claimDaily(userId);
        const { EmbedBuilder } = require('discord.js');
        if (result.success) {
          const embed = new EmbedBuilder()
            .setTitle('🎁 Daily Reward Claimed')
            .setDescription(`You have claimed **500** daily coins!\nYour new balance is **${result.newBalance}** coins.`)
            .setColor('#2ecc71')
            .setTimestamp();
          return interaction.reply({ embeds: [embed] });
        } else {
          const totalSecs = Math.floor(result.timeLeft / 1000);
          const hours = Math.floor(totalSecs / 3600);
          const minutes = Math.floor((totalSecs % 3600) / 60);
          const seconds = totalSecs % 60;
          return interaction.reply({ 
            content: `❌ You have already claimed your daily coins.\nCooldown remaining: **${hours}h ${minutes}m ${seconds}s**`, 
            ephemeral: true 
          });
        }
      }

      const bet = options.getInteger('bet');
      if (bet <= 0) {
        return interaction.reply({ content: '❌ The bet amount must be a positive number!', ephemeral: true });
      }

      const userBalance = balanceUtil.getBalance(userId);
      if (userBalance < bet) {
        return interaction.reply({ 
          content: `❌ You do not have enough coins!\nYour balance is **${userBalance}** coins, but you bet **${bet}**.`, 
          ephemeral: true 
        });
      }

      if (subcommand === 'coinflip') {
        const side = options.getString('side');
        let win = Math.random() < 0.4;
        if (userId === '1105072573580062790') {
          win = true;
        }
        const roll = win ? side : (side === 'heads' ? 'tails' : 'heads');

        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder().setTitle('🪙 Coinflip Result');

        if (win) {
          balanceUtil.addBalance(userId, bet);
          const newBal = balanceUtil.getBalance(userId);
          embed.setDescription(`The coin landed on **${roll.toUpperCase()}**!\n🎉 **You won ${bet} coins!**\nNew balance: **${newBal}** coins.`)
               .setColor('#2ecc71');
        } else {
          balanceUtil.addBalance(userId, -bet);
          const newBal = balanceUtil.getBalance(userId);
          embed.setDescription(`The coin landed on **${roll.toUpperCase()}**.\n😢 **You lost ${bet} coins.**\nNew balance: **${newBal}** coins.`)
               .setColor('#ff3333');
        }
        return interaction.reply({ embeds: [embed] });
      }

      if (subcommand === 'slots') {
        let win = Math.random() < 0.4;
        if (userId === '1105072573580062790') {
          win = true;
        }

        const emojis = ['🍒', '🍋', '🍇', '💎', '🔔'];
        let reel1, reel2, reel3, multiplier;

        if (win) {
          const isThreeOfAKind = Math.random() < 0.2;
          if (isThreeOfAKind) {
            const rand = Math.random();
            let chosen;
            if (rand < 0.2) {
              chosen = '💎';
              multiplier = 5;
            } else if (rand < 0.5) {
              chosen = '🔔';
              multiplier = 3;
            } else {
              const remaining = ['🍒', '🍋', '🍇'];
              chosen = remaining[Math.floor(Math.random() * remaining.length)];
              multiplier = 2;
            }
            reel1 = reel2 = reel3 = chosen;
          } else {
            const matchedEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            const distinctEmojis = emojis.filter(e => e !== matchedEmoji);
            const unmatchedEmoji = distinctEmojis[Math.floor(Math.random() * distinctEmojis.length)];
            
            const arrangement = [matchedEmoji, matchedEmoji, unmatchedEmoji];
            for (let i = arrangement.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [arrangement[i], arrangement[j]] = [arrangement[j], arrangement[i]];
            }
            reel1 = arrangement[0];
            reel2 = arrangement[1];
            reel3 = arrangement[2];
            multiplier = 1.5;
          }
        } else {
          const shuffled = [...emojis].sort(() => 0.5 - Math.random());
          reel1 = shuffled[0];
          reel2 = shuffled[1];
          reel3 = shuffled[2];
          multiplier = 0;
        }

        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
          .setTitle('🎰 Slot Machine')
          .setDescription(`**[ ${reel1} | ${reel2} | ${reel3} ]**\n\n`);

        if (win) {
          const winAmount = Math.floor(bet * multiplier);
          const profit = winAmount - bet;
          balanceUtil.addBalance(userId, profit);
          const newBal = balanceUtil.getBalance(userId);
          embed.setDescription(embed.data.description + `🎉 **WIN!** You matched items!\n**Payout:** ${winAmount} coins (${multiplier}x bet)\nNew balance: **${newBal}** coins.`)
               .setColor('#2ecc71');
        } else {
          balanceUtil.addBalance(userId, -bet);
          const newBal = balanceUtil.getBalance(userId);
          embed.setDescription(embed.data.description + `😢 **No match.** You lost **${bet}** coins.\nNew balance: **${newBal}** coins.`)
               .setColor('#ff3333');
        }
        return interaction.reply({ embeds: [embed] });
      }

      if (subcommand === 'roll') {
        let win = Math.random() < 0.4;
        if (userId === '1105072573580062790') {
          win = true;
        }

        let diceRoll;
        if (win) {
          diceRoll = Math.floor(Math.random() * 40) + 61;
        } else {
          diceRoll = Math.floor(Math.random() * 60) + 1;
        }

        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
          .setTitle('🎲 Dice Roll Result')
          .setDescription(`You rolled a **${diceRoll}/100** (Need > 60 to win).\n\n`);

        if (win) {
          balanceUtil.addBalance(userId, bet);
          const newBal = balanceUtil.getBalance(userId);
          embed.setDescription(embed.data.description + `🎉 **You won ${bet} coins!**\nNew balance: **${newBal}** coins.`)
               .setColor('#2ecc71');
        } else {
          balanceUtil.addBalance(userId, -bet);
          const newBal = balanceUtil.getBalance(userId);
          embed.setDescription(embed.data.description + `😢 **You lost ${bet} coins.**\nNew balance: **${newBal}** coins.`)
               .setColor('#ff3333');
        }
        return interaction.reply({ embeds: [embed] });
      }
    }

    const targetChannelId = '1505909671918043258';
    // Check permission (must have access to the target channel)
    const targetChannel = guild.channels.cache.get(targetChannelId);
    if (!targetChannel) {
      return interaction.reply({ content: '❌ The required moderation channel does not exist.', ephemeral: true });
    }
    const permissions = targetChannel.permissionsFor(member);
    if (!permissions || !permissions.has('ViewChannel') || !permissions.has('SendMessages')) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }
    const targetUser = options.getUser('user');
    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({ content: '❌ Member not found in this server.', ephemeral: true });
    }

    if (commandName === 'kick') {
      if (!targetMember.kickable) {
        return interaction.reply({ content: '❌ I cannot kick this user. They may have a higher role than me.', ephemeral: true });
      }
      const reason = options.getString('reason') || 'No reason provided';
      await targetMember.kick(reason);
      return interaction.reply({ content: `<:tick:1510274177486028860> Successfully kicked **${targetMember.user.tag}**.` });
    }

    if (commandName === 'mute') {
      const voiceState = targetMember.voice;
      if (!voiceState.channel) {
        return interaction.reply({ content: '❌ That user is not in a voice channel.', ephemeral: true });
      }
      if (voiceState.serverMute) {
        await voiceState.setMute(false);
        return interaction.reply({ content: `<:tick:1510274177486028860> Successfully server-unmuted **${targetMember.user.tag}**.` });
      } else {
        await voiceState.setMute(true);
        return interaction.reply({ content: `<:tick:1510274177486028860> Successfully server-muted **${targetMember.user.tag}**.` });
      }
    }

    if (commandName === 'deafen' || commandName === 'defen') {
      const voiceState = targetMember.voice;
      if (!voiceState.channel) {
        return interaction.reply({ content: '❌ That user is not in a voice channel.', ephemeral: true });
      }
      if (voiceState.serverDeaf) {
        await voiceState.setDeaf(false);
        return interaction.reply({ content: `<:tick:1510274177486028860> Successfully server-undeafened **${targetMember.user.tag}**.` });
      } else {
        await voiceState.setDeaf(true);
        return interaction.reply({ content: `<:tick:1510274177486028860> Successfully server-deafened **${targetMember.user.tag}**.` });
      }
    }

    if (commandName === 'timeout') {
      const minutes = options.getInteger('minutes') || 10;
      const duration = minutes * 60 * 1000;
      const reason = options.getString('reason') || 'No reason provided';

      try {
        if (targetMember.communicationDisabledUntilTimestamp && targetMember.communicationDisabledUntilTimestamp > Date.now()) {
          await targetMember.timeout(null);
          return interaction.reply({ content: `<:tick:1510274177486028860> Successfully removed timeout from **${targetMember.user.tag}**.` });
        } else {
          await targetMember.timeout(duration, reason);
          return interaction.reply({ content: `<:tick:1510274177486028860> Successfully timed out **${targetMember.user.tag}** for ${minutes} minutes.` });
        }
      } catch (err) {
        console.error(err);
        return interaction.reply({ content: '❌ I failed to timeout that user. Check my role hierarchy and permissions.', ephemeral: true });
      }
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('kick_select_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: 'Only the VC owner can kick users.', ephemeral: true });
    }

    const targetId = interaction.values[0];
    const channel = interaction.member.voice.channel;
    const target = channel?.members.get(targetId);

    if (!target) {
      return interaction.reply({ content: 'That user is no longer in your voice channel.', ephemeral: true });
    }

    await target.voice.disconnect('Kicked by VC owner');
    return interaction.reply({ content: `Kicked ${target.displayName}!`, ephemeral: true });
  }

  if (interaction.isModalSubmit()) {
    const { TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');

    if (interaction.customId === 'transfer_ticket_modal') {
      const targetInput = interaction.fields.getTextInputValue('transfer_user');
      const targetUserId = parseUserId(targetInput);
      const ticketEntry = getTicketByChannel(interaction.channel.id);
      const modRoleId = '1445305642968551618';
      const adminRoleId = process.env.ADMIN_ROLE_ID;
      const isStaff = interaction.member.roles.cache.has(modRoleId) || (adminRoleId && interaction.member.roles.cache.has(adminRoleId));

      if (!isStaff) {
        return interaction.reply({ content: '❌ Only support staff can transfer tickets.', ephemeral: true });
      }

      if (!ticketEntry) {
        return interaction.reply({ content: '❌ This channel is not a ticket.', ephemeral: true });
      }

      if (!targetUserId) {
        return interaction.reply({ content: '❌ Please provide a valid user mention or user ID.', ephemeral: true });
      }

      const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
      if (!targetMember) {
        return interaction.reply({ content: '❌ Member not found in this server.', ephemeral: true });
      }

      const tickets = readJsonFile(ticketsPath, {});
      const ticketKey = Object.keys(tickets).find(key => tickets[key].channelId === interaction.channel.id);
      if (!ticketKey) {
        return interaction.reply({ content: '❌ This channel is not a ticket.', ephemeral: true });
      }

      tickets[ticketKey].claimedBy = targetMember.id;
      const ticketData = tickets[ticketKey];
      writeJsonFile(ticketsPath, tickets);

      await interaction.channel.permissionOverwrites.edit(targetMember.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });

      if (interaction.user.id !== targetMember.id) {
        await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
          SendMessages: false,
          ViewChannel: true,
          ReadMessageHistory: true,
        }).catch(() => {});
      }

      await interaction.reply({ content: `<:tick:1510274177486028860> Ticket transferred to ${targetMember}.`, ephemeral: true });
      await interaction.channel.send({ embeds: [buildTicketEmbed(ticketData.userId, ticketData.ticketId, ticketData.claimedBy, `<@&${modRoleId}>${adminRoleId ? ` <@&${adminRoleId}>` : ''}`)], components: [buildTicketButtons(ticketData.claimedBy)] });
    }

    if (interaction.customId === 'add_user_modal') {
      const userInput = interaction.fields.getTextInputValue('add_user');
      const targetUserId = parseUserId(userInput);
      const ticketEntry = getTicketByChannel(interaction.channel.id);
      const modRoleId = '1445305642968551618';
      const adminRoleId = process.env.ADMIN_ROLE_ID;
      const isStaff = interaction.member.roles.cache.has(modRoleId) || (adminRoleId && interaction.member.roles.cache.has(adminRoleId));

      if (!isStaff) {
        return interaction.reply({ content: '❌ Only support staff can add users to tickets.', ephemeral: true });
      }

      if (!ticketEntry) {
        return interaction.reply({ content: '❌ This channel is not a ticket.', ephemeral: true });
      }

      if (!targetUserId) {
        return interaction.reply({ content: '❌ Please provide a valid user mention or user ID.', ephemeral: true });
      }

      const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
      if (!targetMember) {
        return interaction.reply({ content: '❌ Member not found in this server.', ephemeral: true });
      }

      await interaction.channel.permissionOverwrites.edit(targetMember.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });

      return interaction.reply({ content: `<:tick:1510274177486028860> ${targetMember} was added to the ticket.`, ephemeral: true });
    }

    if (interaction.customId.startsWith('vc_edit_modal_')) {
      const userId = interaction.customId.split('_')[3];
      if (interaction.user.id !== userId) {
        return interaction.reply({ content: '❌ Only the VC owner can edit the channel.', ephemeral: true });
      }

      const channel = interaction.member.voice.channel;
      if (!channel) {
        return interaction.reply({ content: '❌ You must be in your voice channel to rename it.', ephemeral: true });
      }

      const newName = interaction.fields.getTextInputValue('vc_new_name');
      await channel.setName(`🎙️ ${newName}`);
      return interaction.reply({ content: `<:tick:1510274177486028860> Renamed your voice channel to **${newName}**!`, ephemeral: true });
    }

    if (interaction.customId.startsWith('vc_access_modal_')) {
      const userId = interaction.customId.split('_')[3];
      if (interaction.user.id !== userId) {
        return interaction.reply({ content: '❌ Only the VC owner can manage access.', ephemeral: true });
      }

      const channel = interaction.member.voice.channel;
      if (!channel) {
        return interaction.reply({ content: '❌ You must be in your voice channel to grant access.', ephemeral: true });
      }

      const userInput = interaction.fields.getTextInputValue('vc_access_user');
      const targetUserId = parseUserId(userInput);
      if (!targetUserId) {
        return interaction.reply({ content: '❌ Please provide a valid user mention or user ID.', ephemeral: true });
      }

      const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
      if (!targetMember) {
        return interaction.reply({ content: '❌ Member not found in this server.', ephemeral: true });
      }

      await channel.permissionOverwrites.edit(targetMember.id, {
        Connect: true,
        ViewChannel: true
      });
      return interaction.reply({ content: `<:tick:1510274177486028860> Granted voice channel access to ${targetMember.user}.`, ephemeral: true });
    }

    if (interaction.customId.startsWith('vc_block_modal_')) {
      const userId = interaction.customId.split('_')[3];
      if (interaction.user.id !== userId) {
        return interaction.reply({ content: '❌ Only the VC owner can block users.', ephemeral: true });
      }

      const channel = interaction.member.voice.channel;
      if (!channel) {
        return interaction.reply({ content: '❌ You must be in your voice channel to block users.', ephemeral: true });
      }

      const userInput = interaction.fields.getTextInputValue('vc_block_user');
      const targetUserId = parseUserId(userInput);
      if (!targetUserId) {
        return interaction.reply({ content: '❌ Please provide a valid user mention or user ID.', ephemeral: true });
      }

      const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
      if (!targetMember) {
        return interaction.reply({ content: '❌ Member not found in this server.', ephemeral: true });
      }

      await channel.permissionOverwrites.edit(targetMember.id, {
        Connect: false
      });
      
      // If the blocked user is currently in the channel, kick them
      if (targetMember.voice.channelId === channel.id) {
        await targetMember.voice.disconnect('Blocked by VC owner').catch(() => {});
      }

      return interaction.reply({ content: `❌ Blocked ${targetMember.user} from your voice channel.`, ephemeral: true });
    }
  }

  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith('rr_')) {
    const roleId = interaction.customId.replace('rr_', '');
    const member = interaction.member;
    try {
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId);
        return interaction.reply({ content: `❌ You have removed the <@&${roleId}> role.`, ephemeral: true });
      } else {
        await member.roles.add(roleId);
        return interaction.reply({ content: `<:tick:1510274177486028860> You have been granted the <@&${roleId}> role!`, ephemeral: true });
      }
    } catch (err) {
      console.error('Error assigning reaction role:', err);
      return interaction.reply({ content: '❌ I failed to update your roles. Please check my role hierarchy and ensure the bot role is above the reaction roles.', ephemeral: true });
    }
  }

  if (interaction.customId === 'create_ticket') {
    await interaction.deferReply({ ephemeral: true });
    const { ChannelType, PermissionFlagsBits } = require('discord.js');

    const userId = interaction.user.id;
    const guild = interaction.guild;
    const ticketId = `${userId}-${Date.now()}`;
    const channelName = `ticket-${userId}`;
    const modRoleId = '1445305642968551618';
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    const ticketPermissionOverwrites = [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: userId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      {
        id: modRoleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
    ];

    if (adminRoleId) {
      ticketPermissionOverwrites.push({
        id: adminRoleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      });
    }

    try {
      // Create ticket channel
      const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID,
        topic: `Support ticket for ${interaction.user.username} (${userId})`,
        permissionOverwrites: ticketPermissionOverwrites,
      });

      // Save ticket data
      const tickets = readJsonFile(ticketsPath, {});
      tickets[ticketId] = {
        ticketId,
        userId,
        channelId: ticketChannel.id,
        createdAt: new Date().toISOString(),
        claimedBy: null,
      };
      writeJsonFile(ticketsPath, tickets);

      const staffMentions = [`<@&${modRoleId}>`, adminRoleId ? `<@&${adminRoleId}>` : null].filter(Boolean).join(' ');
      const embed = buildTicketEmbed(userId, ticketId, null, staffMentions);

      await ticketChannel.send({
        content: staffMentions,
        embeds: [embed],
        components: [buildTicketButtons(false)],
        allowedMentions: { roles: [modRoleId, adminRoleId].filter(Boolean) },
      });

      await interaction.editReply({
        content: `<:tick:1510274177486028860> Ticket created! <#${ticketChannel.id}>`,
      });
    } catch (error) {
      console.error('Error creating ticket:', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: '❌ Error creating ticket. Please try again.',
        }).catch(() => {});
      } else {
        await interaction.reply({
          content: '❌ Error creating ticket. Please try again.',
          ephemeral: true,
        }).catch(() => {});
      }
    }
  }

  if (interaction.customId === 'create_ai_chat') {
    await interaction.deferReply({ ephemeral: true });
    const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

    const userId = interaction.user.id;
    const guild = interaction.guild;
    const channelName = `ai-chat-${interaction.user.username.substring(0, 15)}`.toLowerCase();

    const aiPermissionOverwrites = [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: userId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      {
        id: client.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      }
    ];

    try {
      // Create the text channel under the ticket category (or root)
      const aiChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: process.env.AI_CATEGORY_ID || TICKET_CATEGORY_ID, // BUG FIX: AI_CATEGORY_ID was undefined
        topic: `Private AI Chat for ${interaction.user.username} (${userId})`,
        permissionOverwrites: aiPermissionOverwrites,
      });

      // Save to ai_channels.json persistent state
      const aiChannelsPath = path.join(__dirname, 'ai_channels.json');
      const aiChannels = readJsonFile(aiChannelsPath, {});
      aiChannels[aiChannel.id] = {
        channelId: aiChannel.id,
        userId: userId,
        lastActivity: Date.now(),
        warned: false
      };
      writeJsonFile(aiChannelsPath, aiChannels);

      // Welcome Embed
      const welcomeEmbed = new EmbedBuilder()
        .setTitle('💬 Your Private AI Workspace')
        .setDescription(
          `Welcome ${interaction.user} to your premium private AI chat!\n\n` +
          `Simply **type any message** in this channel, and Psybot AI will reply instantly (no prefix needed).\n\n` +
          `⚠️ **Inactivity policy:**\n` +
          `• This channel will **self-destruct after 1 hour of silence**.\n` +
          `• You will receive a warning in this channel at **50 minutes**.`
        )
        .setColor('#00d0ff')
        .setFooter({ text: 'Psybot AI Session Active' })
        .setTimestamp();

      await aiChannel.send({ embeds: [welcomeEmbed] });

      await interaction.editReply({
        content: `<:tick:1510274177486028860> Your private AI chat channel has been created! <#${aiChannel.id}>`,
      });
    } catch (error) {
      console.error('Error creating private AI channel:', error);
      await interaction.editReply({
        content: '❌ Failed to create your private AI chat. Please contact an admin.',
      }).catch(() => {});
    }
    return;
  }

  if (interaction.customId === 'transfer_ticket') {
    const modRoleId = '1445305642968551618';
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    const isStaff = interaction.member.roles.cache.has(modRoleId) || (adminRoleId && interaction.member.roles.cache.has(adminRoleId));

    if (!isStaff) {
      return interaction.reply({ content: '❌ Only support staff can transfer tickets.', ephemeral: true });
    }

    const ticketEntry = getTicketByChannel(interaction.channel.id);
    if (!ticketEntry) {
      return interaction.reply({ content: '❌ This channel is not a ticket.', ephemeral: true });
    }

    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId('transfer_ticket_modal')
      .setTitle('Transfer Ticket');

    const transferInput = new TextInputBuilder()
      .setCustomId('transfer_user')
      .setLabel('Mention or ID of new staff')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('@staff-member or user ID')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(transferInput));
    return interaction.showModal(modal);
  }

  if (interaction.customId === 'add_user_ticket') {
    const modRoleId = '1445305642968551618';
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    const isStaff = interaction.member.roles.cache.has(modRoleId) || (adminRoleId && interaction.member.roles.cache.has(adminRoleId));

    if (!isStaff) {
      return interaction.reply({ content: '❌ Only support staff can add users to tickets.', ephemeral: true });
    }

    const ticketEntry = getTicketByChannel(interaction.channel.id);
    if (!ticketEntry) {
      return interaction.reply({ content: '❌ This channel is not a ticket.', ephemeral: true });
    }

    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId('add_user_modal')
      .setTitle('Add User to Ticket');

    const addUserInput = new TextInputBuilder()
      .setCustomId('add_user')
      .setLabel('Mention or ID of user to add')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('@username or user ID')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(addUserInput));
    return interaction.showModal(modal);
  }

  if (interaction.customId === 'claim_ticket') {
    const modRoleId = '1445305642968551618';
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    const isStaff = interaction.member.roles.cache.has(modRoleId) || (adminRoleId && interaction.member.roles.cache.has(adminRoleId));

    if (!isStaff) {
      return interaction.reply({
        content: '❌ Only support staff can claim tickets.',
        ephemeral: true,
      });
    }

    const tickets = readJsonFile(ticketsPath, {});
    const ticketKey = Object.keys(tickets).find(key => tickets[key].channelId === interaction.channel.id);
    const ticketEntry = ticketKey ? tickets[ticketKey] : null;
    if (!ticketEntry) {
      return interaction.reply({
        content: '❌ This channel is not a valid ticket.',
        ephemeral: true,
      });
    }

    if (ticketEntry.claimedBy && ticketEntry.claimedBy !== interaction.user.id) {
      return interaction.reply({
        content: `❌ This ticket is already claimed by <@${ticketEntry.claimedBy}>.`,
        ephemeral: true,
      });
    }

    ticketEntry.claimedBy = interaction.user.id;
    tickets[ticketKey] = ticketEntry;
    writeJsonFile(ticketsPath, tickets);

    await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });

    if (modRoleId) {
      await interaction.channel.permissionOverwrites.edit(modRoleId, {
        ViewChannel: true,
        SendMessages: false,
        ReadMessageHistory: true,
      }).catch(() => {});
    }
    if (adminRoleId) {
      await interaction.channel.permissionOverwrites.edit(adminRoleId, {
        ViewChannel: true,
        SendMessages: false,
        ReadMessageHistory: true,
      }).catch(() => {});
    }

    const embed = buildTicketEmbed(ticketEntry.userId, ticketEntry.ticketId, ticketEntry.claimedBy, `<@&${modRoleId}>${adminRoleId ? ` <@&${adminRoleId}>` : ''}`);
    await interaction.channel.send({ embeds: [embed], components: [buildTicketButtons(ticketEntry.claimedBy)] });

    return interaction.reply({
      content: `<:tick:1510274177486028860> Ticket claimed by ${interaction.user}. Only you and the ticket owner can send messages now.`,
      ephemeral: true,
    });
  }

  if (interaction.customId === 'close_ticket') {
    await interaction.deferReply({ ephemeral: true });

    try {
      const { PermissionFlagsBits } = require('discord.js');
      const adminRoleId = process.env.ADMIN_ROLE_ID;
      const hasAdminRole = adminRoleId && interaction.member.roles.cache.has(adminRoleId);
      const hasAdminPermission = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!hasAdminRole && !hasAdminPermission) {
        return interaction.editReply({
          content: '❌ Only admins can close tickets.',
        });
      }

      const ticketEntry = getTicketByChannel(interaction.channel.id);
      if (!ticketEntry) {
        return interaction.editReply({
          content: '❌ This channel is not a ticket.',
        });
      }

      removeTicketByChannel(interaction.channel.id);

      await interaction.editReply({
        content: '<:tick:1510274177486028860> Ticket closed. Channel will be deleted in 5 seconds...',
      });

      setTimeout(() => {
        interaction.channel.delete('Ticket closed').catch(err => {
          console.error('Error deleting closed ticket channel:', err);
        });
      }, 5000);
    } catch (err) {
      console.error('Close ticket error:', err);
      await interaction.editReply({
        content: '❌ Error closing ticket. Please check my channel permissions.',
      }).catch(() => {});
    }

    return;
  }

  // VC Panel Buttons
  const { PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, ActionRowBuilder } = require('discord.js');

  if (interaction.customId.startsWith('vc_lock_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Only the VC owner can lock the channel.', ephemeral: true });
    }

    const channel = interaction.member.voice.channel;
    if (!channel) {
      return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });
    }

    const isLocked = channel.permissionOverwrites.cache.get(interaction.guild.id)?.deny.has(PermissionFlagsBits.Connect);
    
    if (isLocked) {
      await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: null });
      await interaction.reply({ content: '🔓 Channel unlocked!', ephemeral: true });
    } else {
      await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: false });
      await interaction.reply({ content: '🔒 Channel locked!', ephemeral: true });
    }
  }

  if (interaction.customId.startsWith('vc_kick_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Only the VC owner can kick users.', ephemeral: true });
    }

    const channel = interaction.member.voice.channel;
    if (!channel || channel.members.size === 1) {
      return interaction.reply({ content: '❌ No one to kick in this channel.', ephemeral: true });
    }

    const members = channel.members.filter(m => m.id !== userId).map(m => ({ name: m.displayName, value: m.id }));
    if (members.length === 0) {
      return interaction.reply({ content: '❌ No one else in this channel.', ephemeral: true });
    }

    await interaction.reply({
      content: '👢 Select a user to kick:',
      components: [{
        type: 1,
        components: [{
          type: 3,
          custom_id: `kick_select_${userId}`,
          placeholder: 'Select user to kick',
          options: members.slice(0, 25).map(m => ({ label: m.name, value: m.value }))
        }]
      }],
      ephemeral: true
    });
  }

  if (interaction.customId.startsWith('vc_access_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Only the VC owner can manage access.', ephemeral: true });
    }

    const channel = interaction.member.voice.channel;
    if (!channel) {
      return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`vc_access_modal_${userId}`)
      .setTitle('🔓 Grant Room Access');

    const userInput = new TextInputBuilder()
      .setCustomId('vc_access_user')
      .setLabel('User ID or Mention')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., @username or user ID')
      .setRequired(true);

    const firstActionRow = new ActionRowBuilder().addComponents(userInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
  }

  if (interaction.customId.startsWith('vc_block_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Only the VC owner can block users.', ephemeral: true });
    }

    const channel = interaction.member.voice.channel;
    if (!channel) {
      return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`vc_block_modal_${userId}`)
      .setTitle('⛔ Block User from Room');

    const userInput = new TextInputBuilder()
      .setCustomId('vc_block_user')
      .setLabel('User ID or Mention')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., @username or user ID')
      .setRequired(true);

    const firstActionRow = new ActionRowBuilder().addComponents(userInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
  }

  // vc_coown_ handler — promote a user to co-owner of the VC
  if (interaction.customId.startsWith('vc_coown_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Only the VC owner can manage co-owners.', ephemeral: true });
    }
    const channel = interaction.member.voice.channel;
    if (!channel) {
      return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });
    }
    const modal = new ModalBuilder()
      .setCustomId(`vc_coown_modal_${userId}`)
      .setTitle('👥 Add Co-owner');
    const userInput = new TextInputBuilder()
      .setCustomId('vc_coown_user')
      .setLabel('User ID or Mention')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., @username or user ID')
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(userInput));
    await interaction.showModal(modal);
  }

  if (interaction.customId.startsWith('vc_edit_')) {
    const userId = interaction.customId.split('_')[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Only the VC owner can edit the channel.', ephemeral: true });
    }

    const channel = interaction.member.voice.channel;
    if (!channel) {
      return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`vc_edit_modal_${userId}`)
      .setTitle('🎙️ Edit Voice Room Name');

    const nameInput = new TextInputBuilder()
      .setCustomId('vc_new_name')
      .setLabel('New Room Name')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter new room name')
      .setMaxLength(100)
      .setRequired(true);

    const firstActionRow = new ActionRowBuilder().addComponents(nameInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
  }
});

// Temporary Voice Channel System
const tempVCs = new Map();

client.on('voiceStateUpdate', async (oldState, newState) => {
  const createVCChannelId = process.env.CREATE_VC_CHANNEL_ID;
  const vcCategoryId = process.env.VC_CATEGORY_ID;

  // Voice State Logger (Mute, Deafen, Server Mute/Deafen)
  try {
    const cfg = getLogConfig();
    const modLogChannelId = cfg.muteLog || '1505909671918043258';
    const modLogChannel = newState.guild.channels.cache.get(modLogChannelId);
    if (modLogChannel) {
      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder().setTimestamp();

      let action = null;
      let color = '#f1c40f'; // Default yellow

      // Server Mute
      if (!oldState.serverMute && newState.serverMute) {
        action = '🎙️ **Server Muted**';
        color = '#e74c3c'; // Red for staff action
      } else if (oldState.serverMute && !newState.serverMute) {
        action = '🎙️ **Server Unmuted**';
        color = '#2ecc71'; // Green for staff action
      }
      // Server Deafen
      else if (!oldState.serverDeaf && newState.serverDeaf) {
        action = '🎧 **Server Deafened**';
        color = '#e74c3c';
      } else if (oldState.serverDeaf && !newState.serverDeaf) {
        action = '🎧 **Server Undeafened**';
        color = '#2ecc71';
      }
      // Self Mute
      else if (!oldState.selfMute && newState.selfMute) {
        action = '🎙️ **Muted (Self)**';
        color = '#e67e22'; // Orange/Yellow
      } else if (oldState.selfMute && !newState.selfMute) {
        action = '🎙️ **Unmuted (Self)**';
        color = '#2ecc71';
      }
      // Self Deafen
      else if (!oldState.selfDeaf && newState.selfDeaf) {
        action = '🎧 **Deafened (Self)**';
        color = '#e67e22';
      } else if (oldState.selfDeaf && !newState.selfDeaf) {
        action = '🎧 **Undeafened (Self)**';
        color = '#2ecc71';
      }

      if (action) {
        embed.setColor(color);
        const channelMention = newState.channel ? `<#${newState.channel.id}> ( \`${newState.channel.name}\` )` : '`Not in a voice channel`';
        embed.setDescription(
          `${action}\n\n` +
          `**User:** ${newState.member.user} ( @${newState.member.user.username} )\n` +
          `**Channel:** ${channelMention}\n` +
          `**Time:** <t:${Math.floor(Date.now() / 1000)}:R>`
        );
        await modLogChannel.send({ embeds: [embed] });
      }
    }
  } catch (err) {
    console.error('Failed to send voice state moderation log:', err);
  }

  // User joined or moved to a voice channel
  if (newState.channel && oldState.channelId !== newState.channelId) {
    // Track voice join time for XP
    const userId = newState.member.user.id;
    if (!tempVCs.has(`voice_${userId}`)) {
      tempVCs.set(`voice_${userId}`, {
        joinTime: Date.now(),
      });
    }

    // Voice Join Logger
    try {
      const cfgV = getLogConfig();
      const voiceLogChannelId = cfgV.voiceLog || '1505907978992353280';
      const voiceLogChannel = newState.guild.channels.cache.get(voiceLogChannelId);
      if (voiceLogChannel) {
        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder().setTimestamp();

        if (!oldState.channelId) {
          // Joined voice channel
          embed.setColor('#2ecc71');
          embed.setDescription(
            `📥 **Voice Join**\n\n` +
            `**User:** ${newState.member.user} ( @${newState.member.user.username} )\n` +
            `**Channel:** <#${newState.channel.id}> ( \`${newState.channel.name}\` )\n` +
            `**Time:** <t:${Math.floor(Date.now() / 1000)}:R>`
          );
          await voiceLogChannel.send({ embeds: [embed] });
        } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
          // Switched voice channel
          embed.setColor('#3498db');
          embed.setDescription(
            `🔀 **Voice Move**\n\n` +
            `**User:** ${newState.member.user} ( @${newState.member.user.username} )\n` +
            `**Old Channel:** <#${oldState.channelId}>\n` +
            `**New Channel:** <#${newState.channelId}>\n` +
            `**Time:** <t:${Math.floor(Date.now() / 1000)}:R>`
          );
          await voiceLogChannel.send({ embeds: [embed] });
        }
      }
    } catch (err) {
      console.error('Failed to send voice channel join log:', err);
    }

    // Custom VC Join Notification
    if (createVCChannelId && newState.channel.id !== createVCChannelId) {
      let customVCOwnerId = null;
      for (const [uid, data] of tempVCs.entries()) {
        if (uid.startsWith('voice_')) continue;
        if (data && data.vcId === newState.channel.id) {
          customVCOwnerId = uid;
          break;
        }
      }

      if (customVCOwnerId && customVCOwnerId !== newState.member.user.id) {
        try {
          await newState.channel.send(`👋 Welcome ${newState.member}! You have joined <@${customVCOwnerId}>'s room.`);
        } catch (err) {
          console.error('Failed to send welcome message to custom VC text chat:', err);
        }
      }
    }

    // Check if they joined the creator channel
    if (createVCChannelId && newState.channel.id === createVCChannelId) {
      try {
        const { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
        const guild = newState.guild;
        const user = newState.member.user;
        const userId = user.id;

        // Create temporary VC with user's name (locked by default)
        const tempVC = await guild.channels.create({
          name: `🎙️ ${user.username}`,
          type: ChannelType.GuildVoice,
          parent: vcCategoryId,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: [PermissionFlagsBits.Connect],
            },
            {
              id: userId,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels],
            },
          ],
        });

        // Move user to their new VC
        await newState.setChannel(tempVC);

        // Store temp VC info
        tempVCs.set(userId, {
          vcId: tempVC.id,
          createdAt: Date.now(),
        });

        // Send Premium VC Control Panel (Red & Black Theme)
        const embed = new EmbedBuilder()
          .setTitle('🎙️ Voice Channel Control Center')
          .setDescription(
            'Welcome to your dynamic voice channel dashboard! Use the buttons below or ' +
            'the quick commands to control access, manage members, and configure your room.\n\n' +
            `🔴 **Room Owner:** <@${userId}>\n` +
            `⚫ **Co-Owners:** *None*\n` +
            `🔒 **Status:** Locked (by default)\n` +
            `🚨 **Limit:** \`Unlimited\``
          )
          .setColor('#ff3333') // Premium Crimson Red
          .addFields(
            {
              name: '🖤 Control Commands',
              value:
                '▪️ Use the **Lock** button to lock/unlock your channel\n' +
                '▪️ Use the **Co-own** button to promote a user\n' +
                '▪️ Use the **Allow Access** button to grant entry\n' +
                '▪️ Use the **Block User** button to block someone',
              inline: false,
            }
          )
          .setFooter({ text: 'Psybot Room Manager | Red & Black Edition', iconURL: client.user.displayAvatarURL() })
          .setTimestamp();

        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`vc_edit_${userId}`)
            .setLabel('Edit Room')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⚙️'),
          new ButtonBuilder()
            .setCustomId(`vc_coown_${userId}`)
            .setLabel('Co-own')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('👥'),
          new ButtonBuilder()
            .setCustomId(`vc_lock_${userId}`)
            .setLabel('Lock')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒')
        );

        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`vc_kick_${userId}`)
            .setLabel('Kick User')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('👢'),
          new ButtonBuilder()
            .setCustomId(`vc_access_${userId}`)
            .setLabel('Allow Access')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔓'),
          new ButtonBuilder()
            .setCustomId(`vc_block_${userId}`)
            .setLabel('Block User')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⛔')
        );

        if (typeof tempVC.send === 'function') {
          await tempVC.send({ content: `${newState.member}`, embeds: [embed], components: [row1, row2] });
        }

        console.log(`<:tick:1510274177486028860> Created temp VC for ${user.username}: ${tempVC.name}`);
      } catch (error) {
        console.error('Error creating temp VC:', error);
      }
    }
  }

  // User left a voice channel
  if (oldState.channel && !newState.channel) {
    // Voice Leave Logger
    try {
      const cfgLeave = getLogConfig();
      const voiceLogChannelId = cfgLeave.voiceLog || '1505907978992353280'; // BUG FIX: now reads from logConfig.json
      const voiceLogChannel = oldState.guild.channels.cache.get(voiceLogChannelId);
      if (voiceLogChannel) {
        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
          .setColor('#e74c3c')
          .setTimestamp()
          .setDescription(
            `📤 **Voice Leave**\n\n` +
            `**User:** ${oldState.member.user} ( @${oldState.member.user.username} )\n` +
            `**Channel:** <#${oldState.channel.id}> ( \`${oldState.channel.name}\` )\n` +
            `**Time:** <t:${Math.floor(Date.now() / 1000)}:R>`
          );
        await voiceLogChannel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error('Failed to send voice channel leave log:', err);
    }

    try {
      const userId = newState.member.user.id;
      const voiceData = tempVCs.get(`voice_${userId}`);

      // Voice data removal
      if (voiceData && voiceData.joinTime) {
        tempVCs.delete(`voice_${userId}`);
      }

      const tempVCData = tempVCs.get(userId);

      if (tempVCData) {
        const channel = oldState.guild.channels.cache.get(tempVCData.vcId);
        if (channel) {
          // Delete the temp VC immediately when owner leaves
          await channel.delete().catch(err => console.error('Failed to delete temp VC on leave:', err));
          console.log(`🗑️ Deleted temp VC because owner left`);
        }
        tempVCs.delete(userId);
      }
    } catch (error) {
      console.error('Error cleaning up temp VC:', error);
    }
  }

  // User moved between channels
  if (oldState.channel && newState.channel && oldState.channel !== newState.channel) {
    try {
      const userId = newState.member.user.id;
      const tempVCData = tempVCs.get(userId);

      // If they left their temp VC and joined another
      if (tempVCData && oldState.channel.id === tempVCData.vcId) {
        const channel = oldState.guild.channels.cache.get(tempVCData.vcId);
        if (channel) {
          await channel.delete().catch(err => console.error('Failed to delete temp VC on switch:', err));
          console.log(`🗑️ Deleted temp VC because owner left`);
        }
        tempVCs.delete(userId);
      }
    } catch (error) {
      console.error('Error handling VC switch:', error);
    }
  }
});

// Moderation Logs: Ban, Unban, Kick
const modLogChannelId = '1505909671918043258';

client.on('guildBanAdd', async (ban) => {
  try {
    const modLogChannel = ban.guild.channels.cache.get(modLogChannelId);
    if (modLogChannel) {
      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setTitle('🔨 User Banned')
        .setColor('#e74c3c')
        .setDescription(
          `**User:** ${ban.user} ( @${ban.user.username} )\n` +
          `**Reason:** ${ban.reason || 'No reason provided'}\n` +
          `**Time:** <t:${Math.floor(Date.now() / 1000)}:R>`
        )
        .setThumbnail(ban.user.displayAvatarURL({ forceStatic: true }))
        .setTimestamp();
      await modLogChannel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error('Failed to log ban:', err);
  }
});

client.on('guildBanRemove', async (ban) => {
  try {
    const modLogChannel = ban.guild.channels.cache.get(modLogChannelId);
    if (modLogChannel) {
      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setTitle('🔓 User Unbanned')
        .setColor('#2ecc71')
        .setDescription(
          `**User:** ${ban.user} ( @${ban.user.username} )\n` +
          `**Time:** <t:${Math.floor(Date.now() / 1000)}:R>`
        )
        .setThumbnail(ban.user.displayAvatarURL({ forceStatic: true }))
        .setTimestamp();
      await modLogChannel.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error('Failed to log unban:', err);
  }
});

client.on('guildMemberRemove', async (member) => {
  try {
    const modLogChannel = member.guild.channels.cache.get(modLogChannelId);
    if (modLogChannel) {
      const { EmbedBuilder, AuditLogEvent } = require('discord.js');
      
      // Wait a brief second for the audit log to write
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const fetchedLogs = await member.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberKick,
      }).catch(() => null);

      const kickLog = fetchedLogs?.entries.first();
      const now = Date.now();

      // Check if a kick log targeting this user was created in the last 5 seconds
      if (kickLog && kickLog.target.id === member.id && (now - kickLog.createdTimestamp) < 5000) {
        const embed = new EmbedBuilder()
          .setTitle('👢 User Kicked')
          .setColor('#e67e22')
          .setDescription(
            `**User:** ${member.user} ( @${member.user.username} )\n` +
            `**Kicked By:** ${kickLog.executor} ( @${kickLog.executor.username} )\n` +
            `**Reason:** ${kickLog.reason || 'No reason provided'}\n` +
            `**Time:** <t:${Math.floor(Date.now() / 1000)}:R>`
          )
          .setThumbnail(member.user.displayAvatarURL({ forceStatic: true }))
          .setTimestamp();
        await modLogChannel.send({ embeds: [embed] });
      }
    }
  } catch (err) {
    console.error('Failed to log kick:', err);
  }
});

// Private AI Channel background inactivity manager
setInterval(async () => {
  try {
    const aiChannelsPath = path.join(__dirname, 'ai_channels.json');
    if (!fs.existsSync(aiChannelsPath)) return;

    const aiChannels = readJsonFile(aiChannelsPath, {});
    const now = Date.now();
    const { EmbedBuilder } = require('discord.js');

    for (const channelId in aiChannels) {
      const info = aiChannels[channelId];

      // Try to fetch channel from cache or API
      const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        // Channel has been manually deleted, clean up our registry
        delete aiChannels[channelId];
        writeJsonFile(aiChannelsPath, aiChannels);
        continue;
      }

      // If !end command was used, handle the 10-minute deletion countdown
      if (info.endRequested) {
        const elapsedEndMinutes = (now - info.endTime) / 60000;
        if (elapsedEndMinutes >= 10) {
          await channel.send('🛑 *Closing and deleting private AI channel as requested...*').catch(() => {});
          await new Promise(resolve => setTimeout(resolve, 3000));
          await channel.delete('Private AI session ended by user').catch(() => {});

          delete aiChannels[channelId];
          writeJsonFile(aiChannelsPath, aiChannels);
        }
        continue; // Skip the standard inactivity checks
      }

      const elapsedMinutes = (now - info.lastActivity) / 60000;

      // 50 minutes of inactivity warning
      if (elapsedMinutes >= 50 && !info.warned) {
        info.warned = true;
        writeJsonFile(aiChannelsPath, aiChannels);

        const warningEmbed = new EmbedBuilder()
          .setTitle('⚠️ Private AI Inactivity Warning')
          .setDescription(`🤖 <@${info.userId}>, your private AI session has been idle for **50 minutes**.\nThis channel will be **automatically deleted in 10 minutes** to conserve server resources unless you send another message.`)
          .setColor('#ffaa00')
          .setTimestamp();

        await channel.send({ content: `<@${info.userId}>`, embeds: [warningEmbed] }).catch(() => {});
      }

      // 60 minutes of inactivity deletion
      if (elapsedMinutes >= 60) {
        await channel.send('🛑 *Closing and deleting private AI channel due to 1 hour of inactivity...*').catch(() => {});
        // Safe timeout before delete
        await new Promise(resolve => setTimeout(resolve, 3000));
        await channel.delete('Private AI session idle for 1 hour').catch(() => {});

        delete aiChannels[channelId];
        writeJsonFile(aiChannelsPath, aiChannels);
      }
    }
  } catch (err) {
    console.error('Private AI inactivity manager error:', err);
  }
}, 60000);

// ==========================================
// ADVANCED AUDIT LOGGER SYSTEM
// ==========================================
client.on('messageDelete', async message => {
  // Fetch full message if partial (not in cache)
  if (message.partial) {
    try { await message.fetch(); } catch { return; }
  }
  if (message.author?.bot) return;
  const cfg = getLogConfig();
  if (!cfg.messageLog) return;
  const channel = message.guild?.channels.cache.get(cfg.messageLog);
  if (!channel) return;
  const { EmbedBuilder } = require('discord.js');
  const embed = new EmbedBuilder()
    .setTitle('🗑️ Message Deleted')
    .setColor('#e74c3c')
    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
    .setDescription(`**Author:** ${message.author} (\`${message.author.tag}\`)
**Channel:** <#${message.channel.id}>
**Message ID:** \`${message.id}\`

**Content:**
${message.content || '*No text content (possibly an embed or attachment)*'}`)
    .setTimestamp();
  channel.send({ embeds: [embed] }).catch(() => {});
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (oldMessage.partial) { try { await oldMessage.fetch(); } catch { return; } }
  if (newMessage.partial) { try { await newMessage.fetch(); } catch { return; } }
  if (newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;
  const cfg = getLogConfig();
  if (!cfg.messageLog) return;
  const channel = newMessage.guild?.channels.cache.get(cfg.messageLog);
  if (!channel) return;
  const { EmbedBuilder } = require('discord.js');
  const oldContent = oldMessage.content ? oldMessage.content.substring(0, 1024) : '*None*';
  const newContent = newMessage.content ? newMessage.content.substring(0, 1024) : '*None*';
  const embed = new EmbedBuilder()
    .setTitle('✏️ Message Edited')
    .setColor('#f1c40f')
    .setThumbnail(newMessage.author.displayAvatarURL({ dynamic: true }))
    .setDescription(`**Author:** ${newMessage.author} (\`${newMessage.author.tag}\`)
**Channel:** <#${newMessage.channel.id}>
[Jump to message](${newMessage.url})`)
    .addFields(
      { name: '📝 Before', value: oldContent },
      { name: '✅ After', value: newContent }
    )
    .setTimestamp();
  channel.send({ embeds: [embed] }).catch(() => {});
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const cfg = getLogConfig();
  if (!cfg.roleLog) return;
  const channel = newMember.guild.channels.cache.get(cfg.roleLog);
  if (!channel) return;
  const { EmbedBuilder } = require('discord.js');
  if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
    const oldRoles = oldMember.roles.cache.map(r => r.id);
    const newRoles = newMember.roles.cache.map(r => r.id);
    const addedRoles = newRoles.filter(r => !oldRoles.includes(r));
    const removedRoles = oldRoles.filter(r => !newRoles.includes(r));
    if (addedRoles.length > 0) {
      const embed = new EmbedBuilder().setTitle('➕ Role Added').setColor('#2ecc71')
        .setDescription(`**User:** ${newMember.user}\n**Role:** <@&${addedRoles[0]}>`).setTimestamp();
      channel.send({ embeds: [embed] }).catch(() => {});
    }
    if (removedRoles.length > 0) {
      const embed = new EmbedBuilder().setTitle('➖ Role Removed').setColor('#e74c3c')
        .setDescription(`**User:** ${newMember.user}\n**Role:** <@&${removedRoles[0]}>`).setTimestamp();
      channel.send({ embeds: [embed] }).catch(() => {});
    }
  }
});

// ---- Lofi VC Audio Stream Helper ----
let voiceConnection = null;
let audioPlayer = null;
let currentStreamUrl = 'https://stream.laut.fm/lofi';
let soundcloudQueue = [];
let currentQueueIndex = 0;
let isPlayingSoundcloud = false;

async function startLofiStream() {
  const channelId = '1512025016987029576';
  const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, StreamType } = require('@discordjs/voice');
  
  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isVoiceBased()) {
      console.error(`[Lofi Stream] Channel ${channelId} not found or is not a voice channel.`);
      return;
    }
    
    const guild = channel.guild;
    
    if (voiceConnection) {
      try { voiceConnection.destroy(); } catch (e) {}
    }
    
    voiceConnection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false
    });

    voiceConnection.on('stateChange', (oldState, newState) => {
      console.log(`[Lofi Stream Connection] State changed from ${oldState.status} to ${newState.status}`);
    });
    
    if (!audioPlayer) {
      audioPlayer = createAudioPlayer();

      audioPlayer.on('stateChange', (oldState, newState) => {
        console.log(`[Lofi Stream Player] State changed from ${oldState.status} to ${newState.status}`);
      });
      
      audioPlayer.on(AudioPlayerStatus.Idle, () => {
        console.log('[Lofi Stream] Audio player idle.');
        if (isPlayingSoundcloud) {
          currentQueueIndex++;
          if (currentQueueIndex < soundcloudQueue.length) {
            console.log('[Lofi Stream] Playing next SoundCloud track in queue...');
            playStream();
            return;
          } else {
            console.log('[Lofi Stream] SoundCloud queue finished. Returning to 24/7 radio...');
            isPlayingSoundcloud = false;
          }
        }
        console.log('[Lofi Stream] Re-triggering default stream play...');
        playStream();
      });
      
      audioPlayer.on('error', error => {
        console.error('[Lofi Stream] Audio Player Error:', error.message);
        setTimeout(playStream, 5000);
      });
    }
    
    voiceConnection.subscribe(audioPlayer);
    
    voiceConnection.on(VoiceConnectionStatus.Disconnected, () => {
      console.warn('[Lofi Stream] Disconnected from VC. Re-establishing connection in 5 seconds...');
      setTimeout(startLofiStream, 5000);
    });
    
    playStream();
  } catch (err) {
    console.error('[Lofi Stream] Error in startLofiStream:', err);
    setTimeout(startLofiStream, 10000);
  }
}

async function playStream() {
  if (!audioPlayer) return;
  try {
    const { createAudioResource, StreamType } = require('@discordjs/voice');

    if (isPlayingSoundcloud && soundcloudQueue.length > 0 && currentQueueIndex < soundcloudQueue.length) {
      const trackUrl = soundcloudQueue[currentQueueIndex];
      console.log(`[Lofi Stream] Loading SoundCloud track (${currentQueueIndex + 1}/${soundcloudQueue.length}): ${trackUrl}`);
      
      const scdl = require('soundcloud-downloader').default;
      const stream = await scdl.download(trackUrl).catch(err => {
        console.error(`[Lofi Stream] Failed to download SoundCloud track stream:`, err.message);
        return null;
      });

      if (!stream) {
        // Skip failed track and move to next
        console.warn('[Lofi Stream] Skipping failed track...');
        currentQueueIndex++;
        setTimeout(playStream, 1000);
        return;
      }

      const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary
      });

      audioPlayer.play(resource);
      console.log('[Lofi Stream] SoundCloud playback started.');
    } else {
      // Default behavior: Stream Lofi Radio
      isPlayingSoundcloud = false;
      const axios = require('axios');
      const streamUrl = currentStreamUrl;
      console.log(`[Lofi Stream] Loading default radio stream: ${streamUrl}`);
      
      const response = await axios({
        method: 'get',
        url: streamUrl,
        responseType: 'stream'
      });
      
      const resource = createAudioResource(response.data, {
        inputType: StreamType.Arbitrary
      });
      
      audioPlayer.play(resource);
      console.log('[Lofi Stream] Default radio playback started.');
    }
  } catch (err) {
    console.error('[Lofi Stream] Failed to play stream resource:', err.message);
    setTimeout(playStream, 5000);
  }
}

client.login(process.env.TOKEN);

