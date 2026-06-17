'use strict';

const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits,
} = require('discord.js');
const { parseUserId } = require('../utils/parseUtils');

// ---------------------------------------------------------------------------
// Button handlers
// ---------------------------------------------------------------------------

/**
 * Handles the vc_lock_<userId> button — toggles channel lock.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleVcLock(interaction) {
  const userId = interaction.customId.split('_')[2];
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: '❌ Only the VC owner can lock the channel.', ephemeral: true });
  }
  const channel = interaction.member.voice.channel;
  if (!channel) return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });

  const isLocked = channel.permissionOverwrites.cache.get(interaction.guild.id)?.deny.has(PermissionFlagsBits.Connect);
  if (isLocked) {
    await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: null });
    return interaction.reply({ content: '🔓 Channel unlocked!', ephemeral: true });
  } else {
    await channel.permissionOverwrites.edit(interaction.guild.id, { Connect: false });
    return interaction.reply({ content: '🔒 Channel locked!', ephemeral: true });
  }
}

/**
 * Handles the vc_kick_<userId> button — shows select menu of channel members.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleVcKick(interaction) {
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
  return interaction.reply({
    content: '👢 Select a user to kick:',
    components: [{
      type: 1,
      components: [{
        type: 3,
        custom_id: `kick_select_${userId}`,
        placeholder: 'Select user to kick',
        options: members.slice(0, 25).map(m => ({ label: m.name, value: m.value })),
      }],
    }],
    ephemeral: true,
  });
}

/**
 * Handles the kick_select_<userId> string select menu — disconnects the chosen member.
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handleKickSelect(interaction) {
  const userId = interaction.customId.split('_')[2];
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: 'Only the VC owner can kick users.', ephemeral: true });
  }
  const targetId = interaction.values[0];
  const channel  = interaction.member.voice.channel;
  const target   = channel?.members.get(targetId);
  if (!target) {
    return interaction.reply({ content: 'That user is no longer in your voice channel.', ephemeral: true });
  }
  await target.voice.disconnect('Kicked by VC owner');
  return interaction.reply({ content: `Kicked ${target.displayName}!`, ephemeral: true });
}

/**
 * Handles the vc_access_<userId> button — shows modal for granting access.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleVcAccess(interaction) {
  const userId = interaction.customId.split('_')[2];
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: '❌ Only the VC owner can manage access.', ephemeral: true });
  }
  const channel = interaction.member.voice.channel;
  if (!channel) return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });

  const modal = new ModalBuilder().setCustomId(`vc_access_modal_${userId}`).setTitle('🔓 Grant Room Access');
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('vc_access_user').setLabel('User ID or Mention')
      .setStyle(TextInputStyle.Short).setPlaceholder('e.g., @username or user ID').setRequired(true)
  ));
  return interaction.showModal(modal);
}

/**
 * Handles the vc_block_<userId> button — shows modal for blocking a user.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleVcBlock(interaction) {
  const userId = interaction.customId.split('_')[2];
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: '❌ Only the VC owner can block users.', ephemeral: true });
  }
  const channel = interaction.member.voice.channel;
  if (!channel) return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });

  const modal = new ModalBuilder().setCustomId(`vc_block_modal_${userId}`).setTitle('⛔ Block User from Room');
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('vc_block_user').setLabel('User ID or Mention')
      .setStyle(TextInputStyle.Short).setPlaceholder('e.g., @username or user ID').setRequired(true)
  ));
  return interaction.showModal(modal);
}

/**
 * Handles the vc_coown_<userId> button — shows modal for adding a co-owner.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleVcCoown(interaction) {
  const userId = interaction.customId.split('_')[2];
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: '❌ Only the VC owner can manage co-owners.', ephemeral: true });
  }
  const channel = interaction.member.voice.channel;
  if (!channel) return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });

  const modal = new ModalBuilder().setCustomId(`vc_coown_modal_${userId}`).setTitle('👥 Add Co-owner');
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('vc_coown_user').setLabel('User ID or Mention')
      .setStyle(TextInputStyle.Short).setPlaceholder('e.g., @username or user ID').setRequired(true)
  ));
  return interaction.showModal(modal);
}

/**
 * Handles the vc_edit_<userId> button — shows modal for renaming the channel.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleVcEdit(interaction) {
  const userId = interaction.customId.split('_')[2];
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: '❌ Only the VC owner can edit the channel.', ephemeral: true });
  }
  const channel = interaction.member.voice.channel;
  if (!channel) return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });

  const modal = new ModalBuilder().setCustomId(`vc_edit_modal_${userId}`).setTitle('🎙️ Edit Voice Room Name');
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('vc_new_name').setLabel('New Room Name')
      .setStyle(TextInputStyle.Short).setPlaceholder('Enter new room name').setMaxLength(100).setRequired(true)
  ));
  return interaction.showModal(modal);
}

// ---------------------------------------------------------------------------
// Modal handlers
// ---------------------------------------------------------------------------

/**
 * Handles vc_edit_modal_<userId> submission — renames the VC.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleVcEditModal(interaction) {
  const userId = interaction.customId.split('_')[3];
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: '❌ Only the VC owner can edit the channel.', ephemeral: true });
  }
  const channel = interaction.member.voice.channel;
  if (!channel) return interaction.reply({ content: '❌ You must be in your voice channel to rename it.', ephemeral: true });

  const newName = interaction.fields.getTextInputValue('vc_new_name');
  await channel.setName(`🎙️ ${newName}`);
  return interaction.reply({ content: `<:tick:1510274177486028860> Renamed your voice channel to **${newName}**!`, ephemeral: true });
}

/**
 * Handles vc_access_modal_<userId> submission — grants a user access to the VC.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleVcAccessModal(interaction) {
  const userId = interaction.customId.split('_')[3];
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: '❌ Only the VC owner can manage access.', ephemeral: true });
  }
  const channel = interaction.member.voice.channel;
  if (!channel) return interaction.reply({ content: '❌ You must be in your voice channel to grant access.', ephemeral: true });

  const targetUserId = parseUserId(interaction.fields.getTextInputValue('vc_access_user'));
  if (!targetUserId) return interaction.reply({ content: '❌ Please provide a valid user mention or user ID.', ephemeral: true });

  const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
  if (!targetMember) return interaction.reply({ content: '❌ Member not found in this server.', ephemeral: true });

  await channel.permissionOverwrites.edit(targetMember.id, { Connect: true, ViewChannel: true });
  return interaction.reply({ content: `<:tick:1510274177486028860> Granted voice channel access to ${targetMember.user}.`, ephemeral: true });
}

/**
 * Handles vc_block_modal_<userId> submission — blocks a user from the VC.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleVcBlockModal(interaction) {
  const userId = interaction.customId.split('_')[3];
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: '❌ Only the VC owner can block users.', ephemeral: true });
  }
  const channel = interaction.member.voice.channel;
  if (!channel) return interaction.reply({ content: '❌ You must be in your voice channel to block users.', ephemeral: true });

  const targetUserId = parseUserId(interaction.fields.getTextInputValue('vc_block_user'));
  if (!targetUserId) return interaction.reply({ content: '❌ Please provide a valid user mention or user ID.', ephemeral: true });

  const targetMember = await interaction.guild.members.fetch(targetUserId).catch(() => null);
  if (!targetMember) return interaction.reply({ content: '❌ Member not found in this server.', ephemeral: true });

  await channel.permissionOverwrites.edit(targetMember.id, { Connect: false });
  if (targetMember.voice.channelId === channel.id) {
    await targetMember.voice.disconnect('Blocked by VC owner').catch(() => {});
  }
  return interaction.reply({ content: `❌ Blocked ${targetMember.user} from your voice channel.`, ephemeral: true });
}

module.exports = {
  handleVcLock,
  handleVcKick,
  handleKickSelect,
  handleVcAccess,
  handleVcBlock,
  handleVcCoown,
  handleVcEdit,
  handleVcEditModal,
  handleVcAccessModal,
  handleVcBlockModal,
};
