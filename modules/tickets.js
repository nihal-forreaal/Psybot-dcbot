'use strict';

const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { readJsonFile, writeJsonFile } = require('../utils/jsonUtils');
const { parseUserId } = require('../utils/parseUtils');

const ticketsPath = path.join(__dirname, '..', 'tickets.json');
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID || '1505164182767800411';
const MOD_ROLE_ID        = '1445305642968551618';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    .setTitle('📋 Support Ticket Opened')
    .setDescription(
      `Hello <@${userId}>, welcome to your private support session.\n\n` +
      `▪️ **Ticket ID:** \`${ticketId}\`\n` +
      `▪️ **Status:** ${claimedBy ? `Claimed by <@${claimedBy}>` : '`Awaiting Staff`🔑'}\n\n` +
      `*Please describe your issue or question in detail here. A representative will join and assist you shortly.*`
    )
    .setColor('#ff3333')
    .setFooter({ text: 'Psybot Support Services', iconURL: clientUser.displayAvatarURL() })
    .setTimestamp();

  if (claimedBy) {
    embed.addFields([
      { name: '🔴 Claimed By', value: `<@${claimedBy}>`, inline: true },
      { name: '⚫ Claim Time', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
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
  const channelName = `ticket-${userId}`;

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

    const tickets = readJsonFile(ticketsPath, {});
    tickets[ticketId] = { ticketId, userId, channelId: ticketChannel.id, createdAt: new Date().toISOString(), claimedBy: null };
    writeJsonFile(ticketsPath, tickets);

    const staffMentions = [`<@&${MOD_ROLE_ID}>`, adminRoleId ? `<@&${adminRoleId}>` : null].filter(Boolean).join(' ');
    const embed = buildTicketEmbed(userId, ticketId, null, staffMentions, interaction.client.user);

    await ticketChannel.send({
      content: staffMentions,
      embeds: [embed],
      components: [buildTicketButtons(false)],
      allowedMentions: { roles: [MOD_ROLE_ID, adminRoleId].filter(Boolean) },
    });

    await interaction.editReply({ content: `<:tick:1510274177486028860> Ticket created! <#${ticketChannel.id}>` });
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
  const ticketKey = Object.keys(tickets).find(k => tickets[k].channelId === interaction.channel.id);
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

  return interaction.reply({
    content: `<:tick:1510274177486028860> Ticket claimed by ${interaction.user}. Only you and the ticket owner can send messages now.`,
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

    removeTicketByChannel(interaction.channel.id);
    await interaction.editReply({ content: '<:tick:1510274177486028860> Ticket closed. Channel will be deleted in 5 seconds...' });
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
  });
  if (interaction.user.id !== targetMember.id) {
    await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
      SendMessages: false, ViewChannel: true, ReadMessageHistory: true,
    }).catch(() => {});
  }

  await interaction.reply({ content: `<:tick:1510274177486028860> Ticket transferred to ${targetMember}.`, ephemeral: true });
  await interaction.channel.send({
    embeds: [buildTicketEmbed(ticketData.userId, ticketData.ticketId, ticketData.claimedBy,
      `<@&${MOD_ROLE_ID}>${adminRoleId ? ` <@&${adminRoleId}>` : ''}`, interaction.client.user)],
    components: [buildTicketButtons(ticketData.claimedBy)],
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
  });
  return interaction.reply({ content: `<:tick:1510274177486028860> ${targetMember} was added to the ticket.`, ephemeral: true });
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
};
