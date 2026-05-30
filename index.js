require('dotenv').config();
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
const LEVEL_SAVE_DELAY_MS = 5000;
const MAX_FAKE_REPLIES = 5;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages
  ],
  partials: [
    Partials.Channel,
    Partials.Message
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
      name: 'setup-logs',
      description: 'Creates all log channels inside the existing log category. Admin only.',
      defaultMemberPermissions: '8'
    }
  ];

  try {
    // Register commands globally so the bot gets the green 'Supports Commands' badge on its profile!
    await client.application.commands.set(slashCommands);
    console.log(`Successfully registered global slash commands for the bot!`);

    // Clear guild-level commands to ensure no duplicates exist (only global ones will remain)
    for (const guild of client.guilds.cache.values()) {
      await guild.commands.set([]);
      console.log(`Cleared guild-specific commands for: ${guild.name}`);
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
// ---- Log Config Helper ----
const logConfigPath = path.join(__dirname, 'logConfig.json');
function getLogConfig() {
  try { return JSON.parse(fs.readFileSync(logConfigPath, 'utf8')); } catch { return {}; }
}

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

    if (commandName === 'setup-logs') {
      if (!member.permissions.has('Administrator')) {
        return interaction.reply({ content: '❌ Only administrators can run this command.', ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      const { ChannelType } = require('discord.js');
      const LOG_CATEGORY_ID = '1505885380023418890';
      const category = guild.channels.cache.get(LOG_CATEGORY_ID);
      if (!category) {
        return interaction.editReply({ content: '❌ Could not find the log category. Check the category ID.' });
      }

      // Delete all existing channels in that category
      const existing = guild.channels.cache.filter(c => c.parentId === LOG_CATEGORY_ID);
      for (const [, ch] of existing) {
        await ch.delete('setup-logs: rebuilding log channels').catch(() => {});
      }

      // Create the 4 log channels
      const everyoneId = guild.roles.everyone.id;
      const adminPerms = [
        { id: everyoneId, deny: ['ViewChannel'] },
        { id: guild.members.me.id, allow: ['ViewChannel', 'SendMessages', 'EmbedLinks', 'ReadMessageHistory'] }
      ];
      const msgLog   = await guild.channels.create({ name: 'message-log',  type: ChannelType.GuildText, parent: LOG_CATEGORY_ID, permissionOverwrites: adminPerms });
      const voiceLog = await guild.channels.create({ name: 'voice-log',    type: ChannelType.GuildText, parent: LOG_CATEGORY_ID, permissionOverwrites: adminPerms });
      const muteLog  = await guild.channels.create({ name: 'mute-log',     type: ChannelType.GuildText, parent: LOG_CATEGORY_ID, permissionOverwrites: adminPerms });
      const roleLog  = await guild.channels.create({ name: 'role-log',     type: ChannelType.GuildText, parent: LOG_CATEGORY_ID, permissionOverwrites: adminPerms });

      // Save channel IDs to logConfig.json
      const cfg = { messageLog: msgLog.id, voiceLog: voiceLog.id, muteLog: muteLog.id, roleLog: roleLog.id };
      fs.writeFileSync(logConfigPath, JSON.stringify(cfg, null, 2));

      return interaction.editReply({ content: `<:tick:1510274177486028860> Log channels created!\n📝 <#${msgLog.id}> | 🎙️ <#${voiceLog.id}> | 🔇 <#${muteLog.id}> | 🎭 <#${roleLog.id}>` });
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
        parent: AI_CATEGORY_ID,
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
                '▪️ `!kick @user` — Kick a user from your channel\n' +
                '▪️ `!own2 @user` — Promote a user to co-owner\n' +
                '▪️ `!access @user` — Grant specific access to a user\n' +
                '▪️ `!block @user` — Block a user from joining',
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
  if (message.author?.bot) return;
  const cfg = getLogConfig();
  if (!cfg.messageLog) return;
  const channel = message.guild?.channels.cache.get(cfg.messageLog);
  if (!channel) return;
  const { EmbedBuilder } = require('discord.js');
  const embed = new EmbedBuilder()
    .setTitle('🗑️ Message Deleted')
    .setColor('#e74c3c')
    .setDescription(`**Author:** ${message.author}\n**Channel:** <#${message.channel.id}>\n\n**Content:**\n${message.content || '*No text content (possibly an embed/attachment)*'}`)
    .setTimestamp();
  channel.send({ embeds: [embed] }).catch(() => {});
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
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
    .setDescription(`**Author:** ${newMessage.author}\n**Channel:** <#${newMessage.channel.id}>\n[Jump to message](${newMessage.url})`)
    .addFields(
      { name: 'Before', value: oldContent },
      { name: 'After', value: newContent }
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

client.login(process.env.TOKEN);

