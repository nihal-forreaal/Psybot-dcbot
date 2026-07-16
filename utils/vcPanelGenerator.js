'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

/**
 * Generates the Embed and Action Rows for the Custom VC Panel.
 * @param {string} ownerId
 * @param {string[]} coOwners
 * @param {number} limit
 * @param {boolean} isLocked
 * @param {boolean} isHidden
 * @param {string} avatarUrl
 * @returns {{embeds: EmbedBuilder[], components: ActionRowBuilder[]}}
 */
function generateVcPanel(ownerId, coOwners = [], limit = 0, isLocked = false, isHidden = false, avatarUrl = '') {
  const coOwnerMentions = coOwners.length > 0 ? coOwners.map(id => `<@${id}>`).join('\n') : '*None*';
  const limitText = limit === 0 ? '∞' : `${limit}`;

  // Status indicators for footer
  let statusText = '🔓 Public VC';
  if (isLocked && isHidden) {
    statusText = '🔒 Hidden & Locked';
  } else if (isLocked) {
    statusText = '🔒 Locked VC';
  } else if (isHidden) {
    statusText = '👁️ Hidden VC';
  }

  const embed = new EmbedBuilder()
    .setTitle('🏛️ Custom VC Panel')
    .setDescription('Use the following buttons and drop down menus to control your voice channel:')
    .setColor('#f1c40f') // Gold/Yellow theme
    .addFields(
      { name: '• 👑 VC Owner :', value: `<@${ownerId}>`, inline: false },
      { name: '• 👑 Co Owners :', value: coOwnerMentions, inline: false },
      { name: '• 👤 VC Limit :', value: limitText, inline: false }
    )
    .setFooter({ text: `${statusText} | Thengakola Custom VC System` });

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  // Row 1: Edit, Co-own, Unlock/Lock (toggled based on status)
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('vc_btn_edit')
      .setLabel('Edit')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🎛️'),
    new ButtonBuilder()
      .setCustomId('vc_btn_coown')
      .setLabel('Co-own')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('👑'),
    new ButtonBuilder()
      .setCustomId(isLocked ? 'vc_btn_unlock' : 'vc_btn_lock')
      .setLabel(isLocked ? 'Unlock' : 'Lock')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(isLocked ? '🔓' : '🔒')
  );

  // Row 2: Kick, Access, Block
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('vc_btn_kick')
      .setLabel('Kick')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('👢'),
    new ButtonBuilder()
      .setCustomId('vc_btn_access')
      .setLabel('Access')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('➕'),
    new ButtonBuilder()
      .setCustomId('vc_btn_block')
      .setLabel('Block')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🚫')
  );

  // Row 3: Select menu for More Options
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('vc_select_more')
    .setPlaceholder('⚙️ More Option')
    .addOptions([
      { label: 'Set Limit: Unlimited', value: 'limit_0', emoji: '👤' },
      { label: 'Set Limit: 2', value: 'limit_2', emoji: '👥' },
      { label: 'Set Limit: 5', value: 'limit_5', emoji: '👥' },
      { label: 'Set Limit: 10', value: 'limit_10', emoji: '👥' },
      { label: 'Set Limit: 20', value: 'limit_20', emoji: '👥' },
      { label: isHidden ? 'Unhide VC' : 'Hide VC', value: isHidden ? 'unhide' : 'hide', emoji: '👁️' },
      { label: 'Reset Permissions', value: 'reset_perms', emoji: '🔄' },
      { label: 'Refresh Panel', value: 'refresh_panel', emoji: '🔁' }
    ]);

  const row3 = new ActionRowBuilder().addComponents(selectMenu);

  return {
    embeds: [embed],
    components: [row1, row2, row3]
  };
}

module.exports = { generateVcPanel };
