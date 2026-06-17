'use strict';

const { EmbedBuilder } = require('discord.js');
const { handleLogCommand, handleLogPageButton } = require('../modules/logging');
const { handleGamble } = require('../modules/gambling');
const {
  handleCreateTicket, handleClaimTicket, handleCloseTicket,
  handleTransferTicketButton, handleAddUserTicketButton,
  handleTransferTicketModal, handleAddUserModal,
} = require('../modules/tickets');
const {
  handleVcLock, handleVcKick, handleKickSelect,
  handleVcAccess, handleVcBlock, handleVcCoown, handleVcEdit,
  handleVcEditModal, handleVcAccessModal, handleVcBlockModal,
} = require('../modules/vcPanel');


// Channel that mod actions are restricted to
const MOD_CHANNEL_ID = '1505909671918043258';

/**
 * Registers the interactionCreate event on the client, routing to the
 * appropriate module handler based on interaction type and customId.
 * @param {import('discord.js').Client} client
 */
function register(client) {
  client.on('interactionCreate', async interaction => {
    try {
      // ── Log page pagination buttons ─────────────────────────────────────────
      if (interaction.isButton() && interaction.customId.startsWith('logpage_')) {
        return await handleLogPageButton(interaction);
      }

      // ── Slash commands ──────────────────────────────────────────────────────
      if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'log')    return await handleLogCommand(interaction);
        if (commandName === 'gamble') return await handleGamble(interaction);

        // Moderation commands (kick, mute, deafen, defen, timeout)
        return await handleModCommand(interaction);
      }

      // ── String select menus ──────────────────────────────────────────────────
      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('kick_select_')) {
        return await handleKickSelect(interaction);
      }

      // ── Modal submissions ────────────────────────────────────────────────────
      if (interaction.isModalSubmit()) {
        if (interaction.customId === 'transfer_ticket_modal') return await handleTransferTicketModal(interaction);
        if (interaction.customId === 'add_user_modal')        return await handleAddUserModal(interaction);
        if (interaction.customId.startsWith('vc_edit_modal_'))   return await handleVcEditModal(interaction);
        if (interaction.customId.startsWith('vc_access_modal_')) return await handleVcAccessModal(interaction);
        if (interaction.customId.startsWith('vc_block_modal_'))  return await handleVcBlockModal(interaction);
        return;
      }

      // ── Buttons ──────────────────────────────────────────────────────────────
      if (!interaction.isButton()) return;

      // Reaction roles
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
          return interaction.reply({
            content: '❌ I failed to update your roles. Please check my role hierarchy and ensure the bot role is above the reaction roles.',
            ephemeral: true,
          });
        }
      }

      // Ticket buttons
      if (interaction.customId === 'create_ticket')   return await handleCreateTicket(interaction);
      if (interaction.customId === 'claim_ticket')    return await handleClaimTicket(interaction);
      if (interaction.customId === 'close_ticket')    return await handleCloseTicket(interaction);
      if (interaction.customId === 'transfer_ticket') return await handleTransferTicketButton(interaction);
      if (interaction.customId === 'add_user_ticket') return await handleAddUserTicketButton(interaction);

      // AI chat creation
      if (interaction.customId === 'create_ai_chat') return await handleCreateAiChat(interaction);

      // VC panel buttons
      if (interaction.customId.startsWith('vc_lock_'))   return await handleVcLock(interaction);
      if (interaction.customId.startsWith('vc_kick_'))   return await handleVcKick(interaction);
      if (interaction.customId.startsWith('vc_access_')) return await handleVcAccess(interaction);
      if (interaction.customId.startsWith('vc_block_'))  return await handleVcBlock(interaction);
      if (interaction.customId.startsWith('vc_coown_'))  return await handleVcCoown(interaction);
      if (interaction.customId.startsWith('vc_edit_'))   return await handleVcEdit(interaction);

    } catch (err) {
      console.error('Unhandled error in interactionCreate:', err);
      if (!interaction.replied && !interaction.deferred) {
        interaction.reply({ content: '❌ An unexpected error occurred.', ephemeral: true }).catch(() => {});
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Moderation slash command handler (kick / mute / deafen / timeout)
// ---------------------------------------------------------------------------

/**
 * Handles kick, mute, deafen, defen, and timeout slash commands.
 * Checks that the invoking member has access to the designated mod channel.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleModCommand(interaction) {
  const { commandName, options, guild, member } = interaction;

  const targetChannel = guild.channels.cache.get(MOD_CHANNEL_ID);
  if (!targetChannel) {
    return interaction.reply({ content: '❌ The required moderation channel does not exist.', ephemeral: true });
  }
  const perms = targetChannel.permissionsFor(member);
  if (!perms || !perms.has('ViewChannel') || !perms.has('SendMessages')) {
    return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
  }

  const targetUser   = options.getUser('user');
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
    const vs = targetMember.voice;
    if (!vs.channel) return interaction.reply({ content: '❌ That user is not in a voice channel.', ephemeral: true });
    if (vs.serverMute) {
      await vs.setMute(false);
      return interaction.reply({ content: `<:tick:1510274177486028860> Successfully server-unmuted **${targetMember.user.tag}**.` });
    } else {
      await vs.setMute(true);
      return interaction.reply({ content: `<:tick:1510274177486028860> Successfully server-muted **${targetMember.user.tag}**.` });
    }
  }

  if (commandName === 'deafen' || commandName === 'defen') {
    const vs = targetMember.voice;
    if (!vs.channel) return interaction.reply({ content: '❌ That user is not in a voice channel.', ephemeral: true });
    if (vs.serverDeaf) {
      await vs.setDeaf(false);
      return interaction.reply({ content: `<:tick:1510274177486028860> Successfully server-undeafened **${targetMember.user.tag}**.` });
    } else {
      await vs.setDeaf(true);
      return interaction.reply({ content: `<:tick:1510274177486028860> Successfully server-deafened **${targetMember.user.tag}**.` });
    }
  }

  if (commandName === 'timeout') {
    const minutes  = options.getInteger('minutes') || 10;
    const duration = minutes * 60 * 1000;
    const reason   = options.getString('reason') || 'No reason provided';
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

module.exports = { register };
