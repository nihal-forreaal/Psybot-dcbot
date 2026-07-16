'use strict';

const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { readJsonFile, writeJsonFile } = require('../utils/jsonUtils');

const ticketsPath = path.join(__dirname, '..', 'tickets.json');
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID || '1505164182767800411';
const MOD_ROLE_ID        = '1445305642968551618';

/**
 * Generates a plain text transcript of all messages in a channel.
 * @param {import('discord.js').TextChannel} channel
 * @returns {Promise<string>}
 */
async function generateTranscript(channel) {
  const messages = [];
  let lastId = null;

  // Fetch up to 500 messages to cover the full ticket conversation
  for (let i = 0; i < 5; i++) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const fetched = await channel.messages.fetch(options).catch(() => null);
    if (!fetched || fetched.size === 0) break;

    messages.push(...fetched.values());
    lastId = fetched.lastKey();
    if (fetched.size < 100) break;
  }

  // Sort messages chronologically
  messages.reverse();

  let transcript = `TRANSCRIPT FOR TICKET CHANNEL: #${channel.name}\n`;
  transcript += `Closed At: ${new Date().toISOString()}\n`;
  transcript += `========================================================================\n\n`;

  for (const msg of messages) {
    const timestamp = msg.createdAt.toISOString().replace('T', ' ').substring(0, 19);
    const authorTag = msg.author.tag;
    const authorId = msg.author.id;
    let content = msg.content || '';

    // Handle embeds if present
    if (msg.embeds && msg.embeds.length > 0) {
      for (const embed of msg.embeds) {
        const title = embed.title ? `[Embed Title: ${embed.title}]` : '';
        const desc = embed.description ? `[Embed Desc: ${embed.description}]` : '';
        content += `\n  ${title} ${desc}`.trim();
      }
    }

    // Handle attachments if present
    if (msg.attachments && msg.attachments.size > 0) {
      for (const attachment of msg.attachments.values()) {
        content += `\n  [Attachment: ${attachment.name} - ${attachment.url}]`;
      }
    }

    transcript += `[${timestamp}] ${authorTag} (${authorId}): ${content}\n`;
  }

  return transcript;
}

/**
 * Logs ticket activity to the configured log channel.
 * @param {import('discord.js').Client} client
 * @param {string} action - 'Created' | 'Claimed' | 'Transferred' | 'Closed' | 'User Added'
 * @param {object} details - details of the action
 */
async function logTicketAction(client, action, details) {
  try {
    const logChannelId = process.env.TICKET_LOG_CHANNEL_ID;
    if (!logChannelId) return;

    const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
    if (!logChannel) {
      console.warn(`[Ticket Logs] Log channel ${logChannelId} not found.`);
      return;
    }

    let color = '#34495e';
    if (action === 'Created') color = '#2ecc71';
    if (action === 'Claimed') color = '#3498db';
    if (action === 'Transferred') color = '#e67e22';
    if (action === 'User Added') color = '#9b59b6';
    if (action === 'Closed') color = '#e74c3c';

    const embed = new EmbedBuilder()
      .setTitle(`🎫 Ticket Log: ${action}`)
      .setColor(color)
      .setTimestamp();

    const fields = [
      { name: 'Ticket ID', value: `\`${details.ticketId}\``, inline: true },
      { name: 'Opened By', value: `<@${details.userId}>`, inline: true }
    ];

    if (details.channelId) {
      fields.push({ name: 'Channel', value: `<#${details.channelId}>`, inline: true });
    } else if (details.channelName) {
      fields.push({ name: 'Channel Name', value: `\`${details.channelName}\``, inline: true });
    }

    if (details.executor) {
      fields.push({ name: 'Executor', value: `${details.executor}`, inline: true });
    }

    if (details.extraInfo) {
      fields.push({ name: 'Details', value: details.extraInfo, inline: false });
    }

    embed.addFields(fields);

    const files = [];
    if (action === 'Closed' && details.channel) {
      try {
        const transcriptText = await generateTranscript(details.channel);
        const buffer = Buffer.from(transcriptText, 'utf-8');
        const { AttachmentBuilder } = require('discord.js');
        const attachment = new AttachmentBuilder(buffer, { name: `transcript-${details.channelName || details.channel.name}.txt` });
        files.push(attachment);
      } catch (transcriptErr) {
        console.error('[Ticket Logs] Failed to generate ticket transcript:', transcriptErr.message);
      }
    }

    const tickets = readJsonFile(ticketsPath, {});
    const ticketEntry = tickets[details.ticketId] || Object.values(tickets).find(t => t.ticketId === details.ticketId);
    const forumThreadId = details.forumThreadId || (ticketEntry ? ticketEntry.forumThreadId : null);

    if (logChannel.type === ChannelType.GuildForum) {
      if (forumThreadId) {
        try {
          const thread = await logChannel.threads.fetch(forumThreadId).catch(() => null);
          if (thread) {
            await thread.send({ embeds: [embed], files });
            if (action === 'Closed') {
              await thread.setName(`📂│ticket-${details.channelName?.replace('ticket-', '') || 'closed'}`).catch(() => {});
              await thread.setLocked(true).catch(() => {});
              await thread.setArchived(true).catch(() => {});
            }
            return;
          }
        } catch (err) {
          console.error('[Ticket Logs] Failed to post update to forum thread:', err.message);
        }
      }

      if (action === 'Closed' || action === 'Created') {
        await logChannel.threads.create({
          name: `${action === 'Closed' ? '📂' : '🎫'}│${details.channelName || `ticket-${details.userId}`}`,
          autoArchiveDuration: 1440,
          reason: `Ticket event log for ${details.ticketId}`,
          message: {
            embeds: [embed],
            files: files
          }
        }).catch(err => console.error('[Ticket Logs] Failed to create forum thread log:', err.message));
      } else {
        const modLogChannel = await client.channels.fetch('1512013682002104340').catch(() => null);
        if (modLogChannel) {
          await modLogChannel.send({ embeds: [embed] }).catch(() => {});
        }
      }
    } else {
      await logChannel.send({ embeds: [embed], files });
    }
  } catch (err) {
    console.error('[Ticket Logs] Failed to send ticket log:', err.message);
  }
}

// Helper to parse mentions or user IDs
function parseUserId(input) {
  if (!input) return null;
  const matches = input.match(/^<@!?(\d+)>$/) || input.match(/^(\d+)$/);
  return matches ? matches[1] : null;
}

/**
 * Returns the ticket entry whose channelId matches, or undefined.
 * @param {string} channelId
 */
function getTicketByChannel(channelId) {
  const tickets = readJsonFile(ticketsPath, {});
  return Object.values(tickets).find(t => t.channelId === channelId);
}

/**
 * Removes the ticket entry whose channelId matches.
 * @param {string} channelId
 */
function removeTicketByChannel(channelId) {
  const tickets = readJsonFile(ticketsPath, {});
  const entry = Object.entries(tickets).find(([, t]) => t.channelId === channelId);
  if (entry) {
    delete tickets[entry[0]];
    writeJsonFile(ticketsPath, tickets);
  }
}

/**
 * Builds the embed shown inside a ticket channel.
 * @param {string} userId
 * @param {string} ticketId
 * @param {string|null} claimedBy
 * @param {string|null} staffMentions
 * @returns {EmbedBuilder}
 */
function buildTicketEmbed(userId, ticketId, claimedBy, staffMentions, clientUser) {
  const embed = new EmbedBuilder()
    .setTitle('🎫 Psybot Support Portal')
    .setDescription(
      `╔══════════════════════════════════════════╗\n\n` +
      `  **Welcome to your Support Ticket**\n\n` +
      `  👤 **Opened By:** <@${userId}>\n` +
      `  🎫 **Ticket ID:** \`${ticketId}\`\n` +
      `  🛎️ **Status:** ${claimedBy ? `Claimed by <@${claimedBy}> 🟢` : '`Awaiting Staff` 🔴'}\n\n` +
      `╚══════════════════════════════════════════╝\n\n` +
      `Please describe your question or issue in detail below. Support representatives have been paged and will join shortly.`
    )
    .setColor('#ff3333')
    .setFooter({ text: 'Psybot Gaming Support', iconURL: clientUser.displayAvatarURL() })
    .setTimestamp();

  if (claimedBy) {
    embed.addFields([
      { name: '🔴 Claimed By', value: `<@${claimedBy}>`, inline: true },
      { name: '⚫ Claim Time', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
    ]);
  }

  return embed;
}

/**
 * Builds the action row of buttons for a ticket channel.
 * @param {boolean} claimed
 * @returns {ActionRowBuilder}
 */
function buildTicketButtons(claimed) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('claim_ticket')
      .setLabel(claimed ? 'Ticket Claimed' : 'Claim Ticket')
      .setStyle(claimed ? ButtonStyle.Secondary : ButtonStyle.Danger)
      .setEmoji('🛎️')
      .setDisabled(Boolean(claimed)),
    new ButtonBuilder()
      .setCustomId('transfer_ticket')
      .setLabel('Transfer')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔁'),
    new ButtonBuilder()
      .setCustomId('add_user_ticket')
      .setLabel('Add User')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('➕'),
    new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒')
  );
}

// ---------------------------------------------------------------------------
// Interaction handlers (called from interactionCreate handler)
// ---------------------------------------------------------------------------

/**
 * Handles the "Create Ticket" button press.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleCreateTicket(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const adminRoleId = process.env.ADMIN_ROLE_ID;
  const userId      = interaction.user.id;
  const guild       = interaction.guild;
  const ticketId    = `${userId}-${Date.now()}`;
  const channelName = `ticket-${interaction.user.username}`;

  const permissionOverwrites = [
    { id: guild.id,     deny:  [PermissionFlagsBits.ViewChannel] },
    { id: userId,       allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: MOD_ROLE_ID,  allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ];
  if (adminRoleId) {
    permissionOverwrites.push({ id: adminRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
  }

  try {
    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID,
      topic: `Support ticket for ${interaction.user.username} (${userId})`,
      permissionOverwrites,
    });

    const forumChannelId = process.env.TICKET_LOG_CHANNEL_ID;
    let forumThreadId = null;
    if (forumChannelId) {
      try {
        const forumChannel = await guild.channels.fetch(forumChannelId).catch(() => null);
        if (forumChannel && forumChannel.type === ChannelType.GuildForum) {
          const thread = await forumChannel.threads.create({
            name: `🎫│ticket-${interaction.user.username}`,
            autoArchiveDuration: 1440,
            reason: `Forum thread for tracking ticket ${ticketId}`,
            message: {
              embeds: [
                new EmbedBuilder()
                  .setTitle(`🎫 Ticket Tracked: ticket-${interaction.user.username}`)
                  .setColor('#3498db')
                  .setDescription(
                    `This forum post tracks the live message activity for ticket channel: <#${ticketChannel.id}>\n\n` +
                    `👤 **Opened By:** ${interaction.user} (ID: \`${userId}\`)\n` +
                    `🎫 **Ticket ID:** \`${ticketId}\``
                  )
                  .setTimestamp()
              ]
            }
          });
          forumThreadId = thread.id;
        }
      } catch (forumErr) {
        console.error('Failed to create forum thread tracking post:', forumErr.message);
      }
    }

    // Save ticket data to database
    const tickets = readJsonFile(ticketsPath, {});
    tickets[ticketId] = { 
      ticketId, 
      userId, 
      channelId: ticketChannel.id, 
      forumThreadId,
      createdAt: new Date().toISOString(), 
      claimedBy: null 
    };
    writeJsonFile(ticketsPath, tickets);

    const staffMentions = [`<@&${MOD_ROLE_ID}>`, adminRoleId ? `<@&${adminRoleId}>` : null].filter(Boolean).join(' ');
    const embed = buildTicketEmbed(userId, ticketId, null, staffMentions, interaction.client.user);

    await ticketChannel.send({
      content: staffMentions,
      embeds: [embed],
      components: [buildTicketButtons(false)],
      allowedMentions: { roles: [MOD_ROLE_ID, adminRoleId].filter(Boolean) },
    });

    // Send Created log entry
    await logTicketAction(interaction.client, 'Created', {
      ticketId,
      userId,
      channelId: ticketChannel.id,
      executor: interaction.user
    });

    await interaction.editReply({ content: `✅ Ticket created! <#${ticketChannel.id}>` });
  } catch (err) {
    console.error('Error creating ticket:', err);
    await interaction.editReply({ content: '❌ Error creating ticket. Please try again.' }).catch(() => {});
  }
}

/**
 * Handles the "Claim Ticket" button press.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleClaimTicket(interaction) {
  const adminRoleId = process.env.ADMIN_ROLE_ID;
  const isStaff = interaction.member.roles.cache.has(MOD_ROLE_ID) ||
                  (adminRoleId && interaction.member.roles.cache.has(adminRoleId));
  if (!isStaff) {
    return interaction.reply({ content: '❌ Only support staff can claim tickets.', ephemeral: true });
  }

  const tickets = readJsonFile(ticketsPath, {});
  const ticketKey = Object.keys(tickets).find(k => tickets[k].channelId === interaction.channel.id || tickets[k].forumThreadId === interaction.channel.id);
  const ticketEntry = ticketKey ? tickets[ticketKey] : null;
  if (!ticketEntry) {
    return interaction.reply({ content: '❌ This channel is not a valid ticket.', ephemeral: true });
  }
  if (ticketEntry.claimedBy && ticketEntry.claimedBy !== interaction.user.id) {
    return interaction.reply({ content: `❌ This ticket is already claimed by <@${ticketEntry.claimedBy}>.`, ephemeral: true });
  }

  ticketEntry.claimedBy = interaction.user.id;
  tickets[ticketKey] = ticketEntry;
  writeJsonFile(ticketsPath, tickets);

  await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
    ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
  });
  if (MOD_ROLE_ID) {
    await interaction.channel.permissionOverwrites.edit(MOD_ROLE_ID, { ViewChannel: true, SendMessages: false, ReadMessageHistory: true }).catch(() => {});
  }
  if (adminRoleId) {
    await interaction.channel.permissionOverwrites.edit(adminRoleId, { ViewChannel: true, SendMessages: false, ReadMessageHistory: true }).catch(() => {});
  }

  const embed = buildTicketEmbed(ticketEntry.userId, ticketEntry.ticketId, ticketEntry.claimedBy,
    `<@&${MOD_ROLE_ID}>${adminRoleId ? ` <@&${adminRoleId}>` : ''}`, interaction.client.user);
  await interaction.channel.send({ embeds: [embed], components: [buildTicketButtons(ticketEntry.claimedBy)] });

  await logTicketAction(interaction.client, 'Claimed', {
    ticketId: ticketEntry.ticketId,
    userId: ticketEntry.userId,
    channelId: interaction.channel.id,
    executor: interaction.user
  });

  if (ticketEntry.forumThreadId) {
    try {
      const thread = await interaction.guild.channels.fetch(ticketEntry.forumThreadId).catch(() => null);
      if (thread) {
        await thread.send({
          embeds: [
            new EmbedBuilder()
              .setDescription(`🛎️ **Claimed:** Support staff ${interaction.user} has claimed this ticket. Only they and the ticket owner can message now.`)
              .setColor('#3498db')
              .setTimestamp()
          ]
        });
      }
    } catch (err) {
      console.error('Failed to notify forum thread on claim:', err.message);
    }
  }

  return interaction.reply({
    content: `✅ Ticket claimed by ${interaction.user}. Only you and the ticket owner can send messages now.`,
    ephemeral: true,
  });
}

/**
 * Handles the "Close Ticket" button press.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleCloseTicket(interaction) {
  await interaction.deferReply({ ephemeral: true });
  try {
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    const hasAdminRole = adminRoleId && interaction.member.roles.cache.has(adminRoleId);
    const hasAdminPermission = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!hasAdminRole && !hasAdminPermission) {
      return interaction.editReply({ content: '❌ Only admins can close tickets.' });
    }

    const ticketEntry = getTicketByChannel(interaction.channel.id);
    if (!ticketEntry) {
      return interaction.editReply({ content: '❌ This channel is not a ticket.' });
    }

    await logTicketAction(interaction.client, 'Closed', {
      ticketId: ticketEntry.ticketId,
      userId: ticketEntry.userId,
      channelName: interaction.channel.name,
      forumThreadId: ticketEntry.forumThreadId,
      executor: interaction.user,
      channel: interaction.channel
    });

    removeTicketByChannel(interaction.channel.id);

    await interaction.editReply({ content: '✅ Ticket closed. Channel will be deleted in 5 seconds...' });
    setTimeout(() => {
      interaction.channel.delete('Ticket closed').catch(err => console.error('Error deleting closed ticket channel:', err));
    }, 5000);
  } catch (err) {
    console.error('Close ticket error:', err);
    await interaction.editReply({ content: '❌ Error closing ticket. Please check my channel permissions.' }).catch(() => {});
  }
}

/**
 * Handles the "Transfer Ticket" button — shows modal.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleTransferTicketButton(interaction) {
  const adminRoleId = process.env.ADMIN_ROLE_ID;
  const isStaff = interaction.member.roles.cache.has(MOD_ROLE_ID) ||
                  (adminRoleId && interaction.member.roles.cache.has(adminRoleId));
  if (!isStaff) return interaction.reply({ content: '❌ Only support staff can transfer tickets.', ephemeral: true });

  const ticketEntry = getTicketByChannel(interaction.channel.id);
  if (!ticketEntry) return interaction.reply({ content: '❌ This channel is not a ticket.', ephemeral: true });

  const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
  const modal = new ModalBuilder().setCustomId('transfer_ticket_modal').setTitle('Transfer Ticket');
  const transferInput = new TextInputBuilder()
    .setCustomId('transfer_user').setLabel('Mention or ID of new staff')
    .setStyle(TextInputStyle.Short).setPlaceholder('@staff-member or user ID').setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(transferInput));
  return interaction.showModal(modal);
}

/**
 * Handles the "Add User" button — shows modal.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleAddUserTicketButton(interaction) {
  const adminRoleId = process.env.ADMIN_ROLE_ID;
  const isStaff = interaction.member.roles.cache.has(MOD_ROLE_ID) ||
                  (adminRoleId && interaction.member.roles.cache.has(adminRoleId));
  if (!isStaff) return interaction.reply({ content: '❌ Only support staff can add users to tickets.', ephemeral: true });

  const ticketEntry = getTicketByChannel(interaction.channel.id);
  if (!ticketEntry) return interaction.reply({ content: '❌ This channel is not a ticket.', ephemeral: true });

  const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
  const modal = new ModalBuilder().setCustomId('add_user_modal').setTitle('Add User to Ticket');
  const addUserInput = new TextInputBuilder()
    .setCustomId('add_user').setLabel('Mention or ID of user to add')
    .setStyle(TextInputStyle.Short).setPlaceholder('@username or user ID').setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(addUserInput));
  return interaction.showModal(modal);
}

/**
 * Handles the "Transfer Ticket" modal submission.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleTransferTicketModal(interaction) {
  const adminRoleId = process.env.ADMIN_ROLE_ID;
  const isStaff = interaction.member.roles.cache.has(MOD_ROLE_ID) ||
                  (adminRoleId && interaction.member.roles.cache.has(adminRoleId));
  if (!isStaff) return interaction.reply({ content: '❌ Only support staff can transfer tickets.', ephemeral: true });

  const targetInput  = interaction.fields.getTextInputValue('transfer_user');
  const targetUserId = parseUserId(targetInput);
  const ticketEntry  = getTicketByChannel(interaction.channel.id);

  if (!ticketEntry) return interaction.reply({ content: '❌ This channel is not a ticket.', ephemeral: true });
  if (!targetUserId) return interaction.reply({ content: '❌ Please provide a valid user mention or user ID.', ephemeral: true });

  const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
  if (!targetMember) return interaction.reply({ content: '❌ Member not found in this server.', ephemeral: true });

  const tickets  = readJsonFile(ticketsPath, {});
  const ticketKey = Object.keys(tickets).find(k => tickets[k].channelId === interaction.channel.id);
  if (!ticketKey) return interaction.reply({ content: '❌ This channel is not a ticket.', ephemeral: true });

  tickets[ticketKey].claimedBy = targetMember.id;
  const ticketData = tickets[ticketKey];
  writeJsonFile(ticketsPath, tickets);

  await interaction.channel.permissionOverwrites.edit(targetMember.id, {
    ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
  }).catch(() => {});
  if (interaction.user.id !== targetMember.id) {
    await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
      SendMessages: false, ViewChannel: true, ReadMessageHistory: true,
    }).catch(() => {});
  }

  await interaction.reply({ content: `✅ Ticket transferred to ${targetMember}.`, ephemeral: true });
  await interaction.channel.send({
    embeds: [buildTicketEmbed(ticketData.userId, ticketData.ticketId, ticketData.claimedBy,
      `<@&${MOD_ROLE_ID}>${adminRoleId ? ` <@&${adminRoleId}>` : ''}`, interaction.client.user)],
    components: [buildTicketButtons(ticketData.claimedBy)],
  });

  await logTicketAction(interaction.client, 'Transferred', {
    ticketId: ticketData.ticketId,
    userId: ticketData.userId,
    channelId: interaction.channel.id,
    executor: interaction.user,
    extraInfo: `Transferred ownership of support session to ${targetMember}.`
  });
}

/**
 * Handles the "Add User" modal submission.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleAddUserModal(interaction) {
  const adminRoleId = process.env.ADMIN_ROLE_ID;
  const isStaff = interaction.member.roles.cache.has(MOD_ROLE_ID) ||
                  (adminRoleId && interaction.member.roles.cache.has(adminRoleId));
  if (!isStaff) return interaction.reply({ content: '❌ Only support staff can add users to tickets.', ephemeral: true });

  const ticketEntry = getTicketByChannel(interaction.channel.id);
  if (!ticketEntry) return interaction.reply({ content: '❌ This channel is not a ticket.', ephemeral: true });

  const userInput    = interaction.fields.getTextInputValue('add_user');
  const targetUserId = parseUserId(userInput);
  if (!targetUserId) return interaction.reply({ content: '❌ Please provide a valid user mention or user ID.', ephemeral: true });

  const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
  if (!targetMember) return interaction.reply({ content: '❌ Member not found in this server.', ephemeral: true });

  await interaction.channel.permissionOverwrites.edit(targetMember.id, {
    ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
  }).catch(() => {});

  await logTicketAction(interaction.client, 'User Added', {
    ticketId: ticketEntry.ticketId,
    userId: ticketEntry.userId,
    channelId: interaction.channel.id,
    executor: interaction.user,
    extraInfo: `Granted ticket access channel permission to ${targetMember}.`
  });

  return interaction.reply({ content: `✅ ${targetMember} was added to the ticket.`, ephemeral: true });
}

module.exports = {
  buildTicketEmbed,
  buildTicketButtons,
  getTicketByChannel,
  removeTicketByChannel,
  handleCreateTicket,
  handleClaimTicket,
  handleCloseTicket,
  handleTransferTicketButton,
  handleAddUserTicketButton,
  handleTransferTicketModal,
  handleAddUserModal,
  logTicketAction,
};
