'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'rrpanel',
  description: 'Spawn the Reaction Roles panel in the designated channel.',
  async execute(message) {
    // Check if user has admin permissions
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    const isAdmin = message.member.permissions.has('Administrator') || (adminRoleId && message.member.roles.cache.has(adminRoleId));
    if (!isAdmin) {
      return message.reply('❌ You do not have permission to use this command.');
    }

    try {
      const channelId = process.env.REACTION_ROLES_CHANNEL_ID || '1510256263743934504';
      const channel = await message.client.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        return message.reply('❌ Could not find the reaction roles channel!');
      }

      const configPath = path.join(__dirname, '..', 'reactionRolesConfig.json');
      let rolesConfig = [];
      if (fs.existsSync(configPath)) {
        rolesConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }

      if (rolesConfig.length === 0) {
        return message.reply('⚠️ No roles configured in `reactionRolesConfig.json`.');
      }

      let descriptionText = '';
      for (const role of rolesConfig) {
        descriptionText += `**${role.label}** = ${role.emoji}\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle('Auto Role')
        .setDescription(descriptionText)
        .setColor('#5865F2')
        .setFooter({ text: 'Psybot Role Manager' });

      // Build Action Rows (max 5 buttons per row)
      const components = [];
      let currentRow = new ActionRowBuilder();

      for (let i = 0; i < rolesConfig.length; i++) {
        const roleData = rolesConfig[i];
        
        let style = ButtonStyle.Primary;
        if (roleData.style === 'Secondary') style = ButtonStyle.Secondary;
        if (roleData.style === 'Success') style = ButtonStyle.Success;
        if (roleData.style === 'Danger') style = ButtonStyle.Danger;

        const button = new ButtonBuilder()
          .setCustomId(`rr_${roleData.roleId}`)
          .setLabel(roleData.label)
          .setStyle(style);

        if (roleData.emoji) {
          button.setEmoji(roleData.emoji);
        }

        currentRow.addComponents(button);

        if (currentRow.components.length === 5 || i === rolesConfig.length - 1) {
          components.push(currentRow);
          currentRow = new ActionRowBuilder();
        }
      }

      await channel.send({ embeds: [embed], components });
      await message.reply(`✅ Reaction roles panel sent to <#${channelId}>!`);
    } catch (error) {
      console.error('Error sending rrpanel:', error);
      await message.reply('❌ An error occurred while sending the panel.');
    }
  },
};
