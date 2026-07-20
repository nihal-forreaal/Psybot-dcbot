'use strict';

const { 
  ModalBuilder, TextInputBuilder, TextInputStyle, 
  ActionRowBuilder, PermissionFlagsBits, StringSelectMenuBuilder
} = require('discord.js');
const vcDatabase = require('../utils/vcDatabase');
const { generateVcPanel } = require('../utils/vcPanelGenerator');
const {
  handleCreateTicket, handleClaimTicket, handleCloseTicket,
  handleTransferTicketButton, handleAddUserTicketButton,
  handleTransferTicketModal, handleAddUserModal
} = require('../modules/tickets');
const { handleLogCommand, handleLogPageButton } = require('../modules/logging');

const DEV_IDS = ['1105072573580062790', '1500513638283345991'];

/**
 * Checks if user is authorized to perform VC panel actions (Owner, Co-owner, Developer, or Administrator).
 */
function isAuthorized(userId, record, member) {
  if (userId === record.ownerId) return true;
  if (record.coOwners && record.coOwners.includes(userId)) return true;
  if (DEV_IDS.includes(userId)) return true;
  if (member && member.permissions && member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return false;
}

/**
 * Parses user ID from text or mention.
 * @param {string} input 
 * @returns {string|null}
 */
function parseUserId(input) {
  if (!input) return null;
  const matches = input.match(/^<@!?(\d+)>$/) || input.match(/^(\d+)$/);
  return matches ? matches[1] : null;
}

/**
 * Helper to update the VC panel message with new state.
 */
async function updatePanel(client, channel, record) {
  if (!record.panelMessageId) return;
  try {
    const avatarUrl = client.user.displayAvatarURL({ extension: 'png' });
    const newPanel = generateVcPanel(
      record.ownerId,
      record.coOwners,
      record.limit,
      record.isLocked,
      record.isHidden,
      avatarUrl
    );
    const msg = await channel.messages.fetch(record.panelMessageId).catch(() => null);
    if (msg) {
      await msg.edit(newPanel);
    }
  } catch (err) {
    console.error('Failed to update VC panel message:', err.message);
  }
}

/**
 * Registers interactionCreate event to handle button presses, select menus, and modal submissions.
 * @param {import('discord.js').Client} client
 */
function register(client) {
  client.on('interactionCreate', async interaction => {
    try {
      // Handle Slash Commands
      if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'youtube') {
          const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
          const embed = new EmbedBuilder()
            .setTitle('🎥 Official YouTube Channel')
            .setDescription(
              'Subscribe and tune in to the **Psybot Live** YouTube channel for gaming content, live streams, and highlights!\n\n' +
              '🔗 **Link:** https://www.youtube.com/@psybotlive'
            )
            .setColor('#FF0000')
            .setFooter({ text: 'Psybot Community Hub', iconURL: interaction.client.user.displayAvatarURL() })
            .setTimestamp();

          const button = new ButtonBuilder()
            .setLabel('Visit YouTube Channel')
            .setStyle(ButtonStyle.Link)
            .setURL('https://www.youtube.com/@psybotlive')
            .setEmoji('📺');

          const row = new ActionRowBuilder().addComponents(button);

          return interaction.reply({ embeds: [embed], components: [row] });
        }
        if (interaction.commandName === 'log') {
          return await handleLogCommand(interaction);
        }
      }

      // 0. Handle Reaction Roles buttons
      if (interaction.isButton() && interaction.customId.startsWith('rr_')) {
        const roleId = interaction.customId.replace('rr_', '');
        const member = interaction.member;
        try {
          if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId);
            return interaction.reply({ 
              content: `🍂 **Role Unequipped:** You have successfully removed the <@&${roleId}> role.`, 
              ephemeral: true 
            });
          } else {
            await member.roles.add(roleId);
            return interaction.reply({ 
              content: `✨ **Role Equipped:** You have been granted the <@&${roleId}> role! Enjoy your new access! 🚀`, 
              ephemeral: true 
            });
          }
        } catch (err) {
          console.error('Error assigning reaction role:', err);
          return interaction.reply({
            content: '❌ I failed to update your roles. Please check my role hierarchy and ensure the bot role is above the reaction roles.',
            ephemeral: true,
          });
        }
      }

      // 1. Handle string select menu for Kicking members
      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('vc_kick_select_')) {
        const channelId = interaction.customId.split('_')[3];
        const record = vcDatabase.getVc(channelId);
        if (!record) {
          return interaction.reply({ content: '❌ This voice channel is no longer active.', ephemeral: true });
        }

        if (!isAuthorized(interaction.user.id, record, interaction.member)) {
          return interaction.reply({ content: '❌ Only the VC owner, co-owners, or administrators can control this channel.', ephemeral: true });
        }

        const targetId = interaction.values[0];
        const channel = interaction.member.voice.channel;
        if (!channel || channel.id !== channelId) {
          return interaction.reply({ content: '❌ You must be in your voice channel to kick someone.', ephemeral: true });
        }

        const targetMember = channel.members.get(targetId);
        if (!targetMember) {
          return interaction.reply({ content: '❌ User is no longer in the channel.', ephemeral: true });
        }

        await targetMember.voice.disconnect('Kicked by VC controller').catch(() => {});
        return interaction.reply({ content: `👢 Successfully kicked ${targetMember.user.tag} from the channel.`, ephemeral: true });
      }

      // 2. Handle button clicks
      if (interaction.isButton()) {
        const ticketButtons = ['create_ticket', 'claim_ticket', 'close_ticket', 'transfer_ticket', 'add_user_ticket'];
        if (ticketButtons.includes(interaction.customId)) {
          if (interaction.customId === 'create_ticket') return await handleCreateTicket(interaction);
          if (interaction.customId === 'claim_ticket') return await handleClaimTicket(interaction);
          if (interaction.customId === 'close_ticket') return await handleCloseTicket(interaction);
          if (interaction.customId === 'transfer_ticket') return await handleTransferTicketButton(interaction);
          if (interaction.customId === 'add_user_ticket') return await handleAddUserTicketButton(interaction);
        }

        if (interaction.customId.startsWith('logpage_')) {
          return await handleLogPageButton(interaction);
        }

        if (interaction.customId.startsWith('vc_btn_')) {
          const channel = interaction.member.voice.channel;
        if (!channel) {
          return interaction.reply({ content: '❌ You must be in your voice channel to manage it.', ephemeral: true });
        }

        const record = vcDatabase.getVc(channel.id);
        if (!record) {
          return interaction.reply({ content: '❌ This voice channel is not managed by the panel system.', ephemeral: true });
        }

        const isOwner = interaction.user.id === record.ownerId;
        if (!isAuthorized(interaction.user.id, record, interaction.member)) {
          return interaction.reply({ content: '❌ Only the VC owner, co-owners, or administrators can control this channel.', ephemeral: true });
        }

        const action = interaction.customId.replace('vc_btn_', '');

        // Lock Voice Channel
        if (action === 'lock') {
          await channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { Connect: false });
          record.isLocked = true;
          vcDatabase.saveVc(channel.id, record);
          await updatePanel(client, channel, record);
          return interaction.reply({ content: '🔒 Voice channel has been locked for everyone.', ephemeral: true });
        }

        // Unlock Voice Channel
        if (action === 'unlock') {
          await channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { Connect: null });
          record.isLocked = false;
          vcDatabase.saveVc(channel.id, record);
          await updatePanel(client, channel, record);
          return interaction.reply({ content: '🔓 Voice channel is now unlocked for everyone.', ephemeral: true });
        }

        // Rename/Edit Room Name Modal
        if (action === 'edit') {
          const modal = new ModalBuilder()
            .setCustomId(`vc_modal_edit_${channel.id}`)
            .setTitle('🎛️ Rename Room');

          const nameInput = new TextInputBuilder()
            .setCustomId('vc_input_name')
            .setLabel('New Room Name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter new channel name')
            .setMaxLength(30)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
          return interaction.showModal(modal);
        }

        // Add Co-owner Modal
        if (action === 'coown') {
          const isAdmin = interaction.member && interaction.member.permissions.has(PermissionFlagsBits.Administrator);
          const isDev = DEV_IDS.includes(interaction.user.id);
          if (!isOwner && !isAdmin && !isDev) {
            return interaction.reply({ content: '❌ Only the main VC owner or administrators can assign co-owners.', ephemeral: true });
          }
          const modal = new ModalBuilder()
            .setCustomId(`vc_modal_coown_${channel.id}`)
            .setTitle('👑 Assign Co-owner');

          const userInput = new TextInputBuilder()
            .setCustomId('vc_input_coown')
            .setLabel('User ID or Mention')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter user mention or ID')
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(userInput));
          return interaction.showModal(modal);
        }

        // Kick Select Menu list
        if (action === 'kick') {
          const members = channel.members.filter(m => m.id !== record.ownerId && !record.coOwners.includes(m.id));
          if (members.size === 0) {
            return interaction.reply({ content: '❌ There is no one else in your channel to kick.', ephemeral: true });
          }

          const selectMenuOptions = members.map(m => ({
            label: m.displayName,
            value: m.id,
            description: m.user.tag
          }));

          const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`vc_kick_select_${channel.id}`)
              .setPlaceholder('Select user to kick')
              .addOptions(selectMenuOptions.slice(0, 25))
          );

          return interaction.reply({
            content: '👢 Select the user you want to kick:',
            components: [row],
            ephemeral: true
          });
        }

        // Grant Access Modal
        if (action === 'access') {
          const modal = new ModalBuilder()
            .setCustomId(`vc_modal_access_${channel.id}`)
            .setTitle('➕ Grant Access');

          const userInput = new TextInputBuilder()
            .setCustomId('vc_input_access')
            .setLabel('User ID or Mention')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter user mention or ID')
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(userInput));
          return interaction.showModal(modal);
        }

        // Block User Modal
        if (action === 'block') {
          const modal = new ModalBuilder()
            .setCustomId(`vc_modal_block_${channel.id}`)
            .setTitle('🚫 Block User');

          const userInput = new TextInputBuilder()
            .setCustomId('vc_input_block')
            .setLabel('User ID or Mention')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter user mention or ID')
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(userInput));
          return interaction.showModal(modal);
        }
      }
    }

      // 3. Handle Select Menu 'More Options'
      if (interaction.isStringSelectMenu() && interaction.customId === 'vc_select_more') {
        const channel = interaction.member.voice.channel;
        if (!channel) {
          return interaction.reply({ content: '❌ You must be in your voice channel to manage it.', ephemeral: true });
        }

        const record = vcDatabase.getVc(channel.id);
        if (!record) {
          return interaction.reply({ content: '❌ This voice channel is not managed by the panel system.', ephemeral: true });
        }

        if (!isAuthorized(interaction.user.id, record, interaction.member)) {
          return interaction.reply({ content: '❌ Only the VC owner, co-owners, or administrators can control this channel.', ephemeral: true });
        }

        const val = interaction.values[0];

        // Set User Limit
        if (val.startsWith('limit_')) {
          const limit = parseInt(val.replace('limit_', ''), 10);
          await channel.setUserLimit(limit);
          record.limit = limit;
          vcDatabase.saveVc(channel.id, record);
          await updatePanel(client, channel, record);
          return interaction.reply({ content: `👥 User limit updated to: ${limit === 0 ? 'Unlimited' : limit}`, ephemeral: true });
        }

        // Hide Channel
        if (val === 'hide') {
          await channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { ViewChannel: false });
          record.isHidden = true;
          vcDatabase.saveVc(channel.id, record);
          await updatePanel(client, channel, record);
          return interaction.reply({ content: '👁️ Voice channel is now hidden from members.', ephemeral: true });
        }

        // Unhide Channel
        if (val === 'unhide') {
          await channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { ViewChannel: null });
          record.isHidden = false;
          vcDatabase.saveVc(channel.id, record);
          await updatePanel(client, channel, record);
          return interaction.reply({ content: '👁️ Voice channel is now visible to everyone.', ephemeral: true });
        }

        // Reset Permissions
        if (val === 'reset_perms') {
          await channel.permissionOverwrites.set([
            {
              id: record.ownerId,
              allow: [
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.ViewChannel
              ]
            }
          ]);
          record.isLocked = false;
          record.isHidden = false;
          vcDatabase.saveVc(channel.id, record);
          await updatePanel(client, channel, record);
          return interaction.reply({ content: '🔄 Permissions reset to default settings.', ephemeral: true });
        }

        // Refresh Panel
        if (val === 'refresh_panel') {
          await updatePanel(client, channel, record);
          return interaction.reply({ content: '🔁 Custom VC Panel refreshed successfully.', ephemeral: true });
        }
      }

      // 4. Handle Modal Submissions
      if (interaction.isModalSubmit()) {
        if (interaction.customId === 'transfer_ticket_modal') return await handleTransferTicketModal(interaction);
        if (interaction.customId === 'add_user_modal') return await handleAddUserModal(interaction);

        if (interaction.customId.startsWith('vc_modal_')) {
          const channel = interaction.member.voice.channel;
        if (!channel) {
          return interaction.reply({ content: '❌ You must be in your voice channel to submit modifications.', ephemeral: true });
        }

        const record = vcDatabase.getVc(channel.id);
        if (!record) {
          return interaction.reply({ content: '❌ This voice channel is not managed by the panel system.', ephemeral: true });
        }

        if (!isAuthorized(interaction.user.id, record, interaction.member)) {
          return interaction.reply({ content: '❌ Only the VC owner, co-owners, or administrators can control this channel.', ephemeral: true });
        }

        const modalType = interaction.customId.split('_')[2];

        // Modal Rename Room
        if (modalType === 'edit') {
          const newName = interaction.fields.getTextInputValue('vc_input_name').trim();
          if (!newName) {
            return interaction.reply({ content: '❌ Invalid channel name.', ephemeral: true });
          }
          await channel.setName(`🎙️│${newName}`);
          return interaction.reply({ content: `🎛️ Renamed room to: **${newName}**`, ephemeral: true });
        }

        // Modal Add Co-owner
        if (modalType === 'coown') {
          const userInput = interaction.fields.getTextInputValue('vc_input_coown');
          const targetId = parseUserId(userInput);
          if (!targetId) {
            return interaction.reply({ content: '❌ Please enter a valid user mention or ID.', ephemeral: true });
          }

          if (targetId === record.ownerId) {
            return interaction.reply({ content: '❌ You are already the owner of this channel.', ephemeral: true });
          }

          if (record.coOwners.includes(targetId)) {
            return interaction.reply({ content: '❌ This user is already a co-owner.', ephemeral: true });
          }

          record.coOwners.push(targetId);
          vcDatabase.saveVc(channel.id, record);

          // Give co-owner channel management permissions
          await channel.permissionOverwrites.edit(targetId, {
            ManageChannels: true,
            MuteMembers: true,
            DeafenMembers: true,
            MoveMembers: true,
            Connect: true,
            ViewChannel: true
          });

          await updatePanel(client, channel, record);
          return interaction.reply({ content: `👑 Promoted <@${targetId}> to co-owner.`, ephemeral: true });
        }

        // Modal Grant Access
        if (modalType === 'access') {
          const userInput = interaction.fields.getTextInputValue('vc_input_access');
          const targetId = parseUserId(userInput);
          if (!targetId) {
            return interaction.reply({ content: '❌ Please enter a valid user mention or ID.', ephemeral: true });
          }

          const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
          if (!targetMember) {
            return interaction.reply({ content: '❌ User not found in this guild.', ephemeral: true });
          }

          await channel.permissionOverwrites.edit(targetId, { Connect: true, ViewChannel: true });
          return interaction.reply({ content: `➕ Granted channel access to ${targetMember.user}.`, ephemeral: true });
        }

        // Modal Block User
        if (modalType === 'block') {
          const userInput = interaction.fields.getTextInputValue('vc_input_block');
          const targetId = parseUserId(userInput);
          if (!targetId) {
            return interaction.reply({ content: '❌ Please enter a valid user mention or ID.', ephemeral: true });
          }

          if (targetId === record.ownerId || record.coOwners.includes(targetId)) {
            return interaction.reply({ content: '❌ You cannot block the owner or co-owners.', ephemeral: true });
          }

          const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
          if (!targetMember) {
            return interaction.reply({ content: '❌ User not found in this guild.', ephemeral: true });
          }

          await channel.permissionOverwrites.edit(targetId, { Connect: false });
          
          // If the blocked user is in the channel, disconnect them
          if (targetMember.voice.channelId === channel.id) {
            await targetMember.voice.disconnect('Blocked by VC owner').catch(() => {});
          }

          return interaction.reply({ content: `🚫 Blocked ${targetMember.user} from joining this voice channel.`, ephemeral: true });
        }
      }
    }
    } catch (err) {
      console.error('Error handling dynamic VC interaction:', err);
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({ content: '❌ An unexpected error occurred.', ephemeral: true });
        } catch (replyErr) {
          console.error('Failed to send error reply:', replyErr.message);
        }
      }
    }
  });
}

module.exports = { register };
