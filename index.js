require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');

const prefix = process.env.PREFIX || '!';
const levelsPath = path.join(__dirname, 'levels.json');
const ticketsPath = path.join(__dirname, 'tickets.json');
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID || '1505164182767800411';
const TICKET_PANEL_CHANNEL_ID = process.env.TICKET_PANEL_CHANNEL_ID || '1505164021186433075';
const LEVEL_SAVE_DELAY_MS = 5000;
const MAX_FAKE_REPLIES = 5;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences
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

  for (const guild of client.guilds.cache.values()) {
    await ensureLevelRoles(guild);
  }

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
    }
  ];

  try {
    // Register commands globally so the bot gets the green 'Supports Commands' badge on its profile!
    await client.application.commands.set(slashCommands);
    console.log(`Successfully registered global slash commands for the bot!`);

    // Also register them on guilds for instant updates without waiting for Discord's global cache (up to 1 hour)
    for (const guild of client.guilds.cache.values()) {
      await guild.commands.set(slashCommands);
      console.log(`Registered slash commands for guild: ${guild.name}`);
    }
  } catch (err) {
    console.error('Error deploying slash commands:', err);
  }
};

client.once('ready', onReady);

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

    await member.send(welcomeMessage);
    await member.send(welcomeMessage);
  } catch (err) {
    console.error(`Could not DM new member ${member.user.tag}:`, err.message);
  }
});

const LEVEL_ROLE_REWARDS = [
  { level: 1, name: 'Nobby' },
  { level: 2, name: 'Normie' },
  { level: 5, name: 'Rookie' },
  { level: 10, name: 'Grinder' },
  { level: 15, name: 'Sweaty' },
  { level: 20, name: 'Pro' },
  { level: 30, name: 'Elite' },
  { level: 35, name: 'Legend' },
  { level: 40, name: 'Mythic' },
  { level: 50, name: 'Godmode' },
];

// Helper function to get role ID for a level
function getLevelRoleId(level) {
  const roleIds = process.env.LEVEL_ROLE_IDS || '';
  const roleMap = {};
  
  roleIds.split(',').forEach(pair => {
    const [lvl, id] = pair.split(':');
    roleMap[parseInt(lvl)] = id;
  });

  return roleMap[level] || null;
}

function getLevelRoleReward(level) {
  return LEVEL_ROLE_REWARDS.find(reward => reward.level === level) || null;
}

async function findOrCreateLevelRole(guild, reward) {
  const configuredRoleId = getLevelRoleId(reward.level);
  if (configuredRoleId) {
    const configuredRole = await guild.roles.fetch(configuredRoleId).catch(() => null);
    if (configuredRole) return configuredRole;
  }

  const roles = await guild.roles.fetch();
  const existingRole = roles.find(role => role.name.toLowerCase() === reward.name.toLowerCase());
  if (existingRole) return existingRole;

  return guild.roles.create({
    name: reward.name,
    reason: `Level ${reward.level} reward role`,
  });
}

async function giveLevelRole(member, level) {
  const reward = getLevelRoleReward(level);
  if (!reward) return;

  try {
    const role = await findOrCreateLevelRole(member.guild, reward);
    if (role && !member.roles.cache.has(role.id)) {
      await member.roles.add(role);
    }
  } catch (err) {
    console.error(`Error adding level ${level} role:`, err);
  }
}

async function ensureLevelRoles(guild) {
  try {
    for (const reward of LEVEL_ROLE_REWARDS) {
      await findOrCreateLevelRole(guild, reward);
    }
    console.log(`Level roles ready in ${guild.name}`);
  } catch (err) {
    console.error(`Error creating level roles in ${guild.name}:`, err);
  }
}

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
    .setTitle('📋 Support Ticket')
    .setDescription(`Hello <@${userId}>, a staff member will be with you shortly.`)
    .setColor('#3ba55d')
    .addFields(
      { name: 'Ticket ID', value: ticketId, inline: false }
    )
    .setFooter({ text: 'Please wait while support joins the ticket.' });

  if (claimedBy) {
    embed.addFields([
      { name: 'Claimed By', value: `<@${claimedBy}>`, inline: true },
      { name: 'Claim Time', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
    ]);
  }

  if (staffMentions) {
    embed.setDescription(`Hello <@${userId}>, ${staffMentions}

A support member will be with you shortly.`);
  }

  return embed;
}

function buildTicketButtons(claimed) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

  const claimButton = new ButtonBuilder()
    .setCustomId('claim_ticket')
    .setLabel(claimed ? 'Claimed' : 'Claim Ticket')
    .setStyle(ButtonStyle.Success)
    .setEmoji('🛎️')
    .setDisabled(Boolean(claimed));

  const transferButton = new ButtonBuilder()
    .setCustomId('transfer_ticket')
    .setLabel('Transfer')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🔁');

  const addUserButton = new ButtonBuilder()
    .setCustomId('add_user_ticket')
    .setLabel('Add User')
    .setStyle(ButtonStyle.Success)
    .setEmoji('➕');

  const closeButton = new ButtonBuilder()
    .setCustomId('close_ticket')
    .setLabel('Close Ticket')
    .setStyle(ButtonStyle.Danger)
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

let levelsCache = null;
let levelsSaveTimer = null;
let levelsDirty = false;

function getLevels() {
  if (!levelsCache) {
    levelsCache = readJsonFile(levelsPath, {});
  }
  return levelsCache;
}

function saveLevelsNow() {
  if (!levelsDirty || !levelsCache) return;
  writeJsonFile(levelsPath, levelsCache);
  levelsDirty = false;
}

function scheduleLevelsSave() {
  levelsDirty = true;
  if (levelsSaveTimer) return;

  levelsSaveTimer = setTimeout(() => {
    levelsSaveTimer = null;
    try {
      saveLevelsNow();
    } catch (err) {
      console.error('Failed to save levels:', err);
    }
  }, LEVEL_SAVE_DELAY_MS);

  if (typeof levelsSaveTimer.unref === 'function') {
    levelsSaveTimer.unref();
  }
}

function flushLevelsBeforeExit() {
  try {
    saveLevelsNow();
  } catch (err) {
    console.error('Failed to save levels before exit:', err);
  }
}

process.once('SIGINT', () => {
  flushLevelsBeforeExit();
  process.exit(0);
});

process.once('SIGTERM', () => {
  flushLevelsBeforeExit();
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

  // Log all messages to the specified channel
  const logChannelId = '1505905409003884634';
  if (message.channel.id !== logChannelId) {
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

  const earlyFakeMatches = earlyNormalizedMessage.match(/\bfake\b/g) || [];
  if (earlyFakeMatches.length > 0) {
    const replyCount = Math.min(earlyFakeMatches.length, MAX_FAKE_REPLIES);
    for (let i = 0; i < replyCount; i += 1) {
      await message.channel.send('ur are the fake one !!');
    }
    return;
  }

  if (/\b(yt|youtube)\b/.test(earlyNormalizedMessage)) {
    return message.channel.send('Search psybotlive 🤫');
  }

  // Level System - Give XP for messages
  try {
    const levels = getLevels();
    const userId = message.author.id;
    const xpGain = Math.floor(Math.random() * 15) + 5; // 5-20 XP per message

    if (!levels[userId]) {
      levels[userId] = { xp: 0, level: 0 };
    }

    levels[userId].xp += xpGain;

    // Check for level up
    const xpNeeded = levels[userId].level * 600 + 600; // 600 XP per level
    if (levels[userId].xp >= xpNeeded) {
      levels[userId].level += 1;
      const newLevel = levels[userId].level;

      // Send level up announcement
      const levelChannel = client.channels.cache.get(process.env.LEVEL_CHANNEL_ID);
      if (levelChannel) {
        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
          .setTitle('🎉 Level Up!')
          .setDescription(`${message.author} has reached Level ${newLevel}!`)
          .addFields(
            { name: '✅ XP', value: `${levels[userId].xp} / ${newLevel * 600 + 600}` },
            { name: '📊 Level', value: `${newLevel}`, inline: true }
          )
          .setColor('#5865F2')
          .setThumbnail(message.author.displayAvatarURL())
          .setFooter({ text: 'Keep grinding to reach the top!' });

        await levelChannel.send({ embeds: [embed] });

        await giveLevelRole(message.member, newLevel);
      }
    }

    scheduleLevelsSave();
  } catch (err) {
    console.error('Level system error:', err);
  }

  if (false) {

    return message.channel.send('Search psybotlive 🤫');
  }

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
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const { commandName, options, guild, member } = interaction;
    const targetChannelId = '1505909671918043258';
    
    // Check permission (must have access to the target channel)
    const targetChannel = guild.channels.cache.get(targetChannelId);
    if (!targetChannel) {
      return interaction.reply({ content: '❌ The required moderation channel does not exist.', ephemeral: true });
    }

    const permissions = targetChannel.permissionsFor(member);
    if (!permissions || !permissions.has('ViewChannel') || !permissions.has('SendMessages')) {
      return interaction.reply({ content: '❌ You do not have permission to use this command (must have access to channel 1505909671918043258).', ephemeral: true });
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
      return interaction.reply({ content: `✅ Successfully kicked **${targetMember.user.tag}**.` });
    }

    if (commandName === 'mute') {
      const voiceState = targetMember.voice;
      if (!voiceState.channel) {
        return interaction.reply({ content: '❌ That user is not in a voice channel.', ephemeral: true });
      }
      if (voiceState.serverMute) {
        await voiceState.setMute(false);
        return interaction.reply({ content: `✅ Successfully server-unmuted **${targetMember.user.tag}**.` });
      } else {
        await voiceState.setMute(true);
        return interaction.reply({ content: `✅ Successfully server-muted **${targetMember.user.tag}**.` });
      }
    }

    if (commandName === 'deafen' || commandName === 'defen') {
      const voiceState = targetMember.voice;
      if (!voiceState.channel) {
        return interaction.reply({ content: '❌ That user is not in a voice channel.', ephemeral: true });
      }
      if (voiceState.serverDeaf) {
        await voiceState.setDeaf(false);
        return interaction.reply({ content: `✅ Successfully server-undeafened **${targetMember.user.tag}**.` });
      } else {
        await voiceState.setDeaf(true);
        return interaction.reply({ content: `✅ Successfully server-deafened **${targetMember.user.tag}**.` });
      }
    }

    if (commandName === 'timeout') {
      const minutes = options.getInteger('minutes') || 10;
      const duration = minutes * 60 * 1000;
      const reason = options.getString('reason') || 'No reason provided';

      try {
        if (targetMember.communicationDisabledUntilTimestamp && targetMember.communicationDisabledUntilTimestamp > Date.now()) {
          await targetMember.timeout(null);
          return interaction.reply({ content: `✅ Successfully removed timeout from **${targetMember.user.tag}**.` });
        } else {
          await targetMember.timeout(duration, reason);
          return interaction.reply({ content: `✅ Successfully timed out **${targetMember.user.tag}** for ${minutes} minutes.` });
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

      await interaction.reply({ content: `✅ Ticket transferred to ${targetMember}.`, ephemeral: true });
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

      return interaction.reply({ content: `✅ ${targetMember} was added to the ticket.`, ephemeral: true });
    }
  }

  if (!interaction.isButton()) return;

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
        content: `✅ Ticket created! <#${ticketChannel.id}>`,
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
      content: `✅ Ticket claimed by ${interaction.user}. Only you and the ticket owner can send messages now.`,
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
        content: '✅ Ticket closed. Channel will be deleted in 5 seconds...',
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
  const { PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');

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
      interaction.reply({ content: '🔓 Channel unlocked!', ephemeral: true });
    } else {
      await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: false });
      interaction.reply({ content: '🔒 Channel locked!', ephemeral: true });
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

    interaction.reply({
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

    interaction.reply({
      content: '🔓 Type a user mention to give access (e.g., @username or user ID):',
      ephemeral: true
    });
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

    interaction.reply({
      content: '⛔ Type a user mention to block (e.g., @username or user ID):',
      ephemeral: true
    });
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

    interaction.reply({
      content: '🎙️ Type the new name for your VC (max 100 characters):',
      ephemeral: true
    });
  }
});

// Temporary Voice Channel System
const tempVCs = new Map();

client.on('voiceStateUpdate', async (oldState, newState) => {
  const createVCChannelId = process.env.CREATE_VC_CHANNEL_ID;
  const vcCategoryId = process.env.VC_CATEGORY_ID;

  // Voice State Logger (Mute, Deafen, Server Mute/Deafen)
  try {
    const modLogChannelId = '1505909671918043258';
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
      const voiceLogChannelId = '1505907978992353280';
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

    // Check if they joined the creator channel
    if (createVCChannelId && newState.channel.id === createVCChannelId) {
      try {
        const { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
        const guild = newState.guild;
        const user = newState.member.user;
        const userId = user.id;

        // Create temporary VC with user's name
        const tempVC = await guild.channels.create({
          name: `🎙️ ${user.username}`,
          type: ChannelType.GuildVoice,
          parent: vcCategoryId,
          permissionOverwrites: [
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

        // Send VC Control Panel
        const embed = new EmbedBuilder()
          .setTitle('🎙️ Custom VC Panel')
          .setDescription('Use the buttons below to control your voice channel:')
          .setColor('#5865F2')
          .addFields(
            { name: '✅ VC Owner', value: `${user.tag}`, inline: true },
            { name: '👥 Co Owners', value: 'None', inline: true },
            { name: '🔢 VC Limit', value: '∞ (Unlimited)', inline: true }
          )
          .setFooter({ text: 'Click buttons to manage your VC' });

        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`vc_edit_${userId}`)
            .setLabel('Edit')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎙️'),
          new ButtonBuilder()
            .setCustomId(`vc_coown_${userId}`)
            .setLabel('Co-own')
            .setStyle(ButtonStyle.Success)
            .setEmoji('👥'),
          new ButtonBuilder()
            .setCustomId(`vc_lock_${userId}`)
            .setLabel('Lock')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🔒')
        );

        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`vc_kick_${userId}`)
            .setLabel('Kick')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('👢'),
          new ButtonBuilder()
            .setCustomId(`vc_access_${userId}`)
            .setLabel('Access')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🔓'),
          new ButtonBuilder()
            .setCustomId(`vc_block_${userId}`)
            .setLabel('Block')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⛔')
        );

        if (typeof tempVC.send === 'function') {
          await tempVC.send({ content: `${newState.member}`, embeds: [embed], components: [row1, row2] });
        }

        console.log(`✅ Created temp VC for ${user.username}: ${tempVC.name}`);
      } catch (error) {
        console.error('Error creating temp VC:', error);
      }
    }
  }

  // User left a voice channel
  if (oldState.channel && !newState.channel) {
    // Voice Leave Logger
    try {
      const voiceLogChannelId = '1505907978992353280';
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

      // Add XP for voice time
      if (voiceData && voiceData.joinTime) {
        const timeSpent = Math.floor((Date.now() - voiceData.joinTime) / 60000); // in minutes
        if (timeSpent > 0) {
          const xpGain = timeSpent * 15; // 15 XP per minute
          const levels = getLevels();

          if (!levels[userId]) {
            levels[userId] = { xp: 0, level: 0 };
          }

          levels[userId].xp += xpGain;

          // Check for level up
          const xpNeeded = levels[userId].level * 600 + 600;
          if (levels[userId].xp >= xpNeeded) {
            levels[userId].level += 1;
            const newLevel = levels[userId].level;

            // Send level up announcement
            const levelChannel = client.channels.cache.get(process.env.LEVEL_CHANNEL_ID);
            if (levelChannel) {
              const { EmbedBuilder } = require('discord.js');
              const user = newState.member.user;
              const embed = new EmbedBuilder()
                .setTitle('🎉 Level Up!')
                .setDescription(`${user} has reached Level ${newLevel}!`)
                .addFields(
                  { name: '✅ XP', value: `${levels[userId].xp} / ${newLevel * 600 + 600}` },
                  { name: '📊 Level', value: `${newLevel}`, inline: true }
                )
                .setColor('#5865F2')
                .setThumbnail(user.displayAvatarURL())
                .setFooter({ text: 'Keep grinding to reach the top!' });

              await levelChannel.send({ embeds: [embed] });

              await giveLevelRole(newState.member, newLevel);
            }
          }

          scheduleLevelsSave();
        }
        tempVCs.delete(`voice_${userId}`);
      }

      const tempVCData = tempVCs.get(userId);

      if (tempVCData) {
        const channel = oldState.guild.channels.cache.get(tempVCData.vcId);
        if (channel) {
          // Delete the temp VC if it's empty
          if (channel.members.size === 0) {
            await channel.delete();
            console.log(`🗑️ Deleted empty temp VC`);
          }
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
        if (channel && channel.members.size === 0) {
          await channel.delete();
          console.log(`🗑️ Deleted empty temp VC`);
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

client.login(process.env.TOKEN);
