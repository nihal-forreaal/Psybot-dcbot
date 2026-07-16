const { PermissionFlagsBits } = require('discord.js');
const { generateVcPanel } = require('../utils/vcPanelGenerator');
const vcDatabase = require('../utils/vcDatabase');

const DEV_IDS = ['1105072573580062790', '1500513638283345991'];

module.exports = {
  name: 'vcpanel',
  description: 'Show Custom VC Panel for your voice channel',
  async execute(message, args) {
    try {
      // Check if user is in a voice channel
      const voiceChannel = message.member.voice.channel;
      if (!voiceChannel) {
        return message.reply('❌ You must be in a voice channel to use this command.');
      }

      // Check if it's a dynamic VC in the database
      const record = vcDatabase.getVc(voiceChannel.id);
      if (!record) {
        return message.reply('❌ You can only manage a dynamic voice channel.');
      }

      const isOwner = message.author.id === record.ownerId;
      const isCoOwner = record.coOwners.includes(message.author.id);
      const isDev = DEV_IDS.includes(message.author.id);
      const isAdmin = message.member && message.member.permissions.has(PermissionFlagsBits.Administrator);
      if (!isOwner && !isCoOwner && !isDev && !isAdmin) {
        return message.reply('❌ Only the VC owner, co-owners, or administrators can manage this channel.');
      }

      // Generate Custom VC Panel Embed
      const avatarUrl = message.client.user.displayAvatarURL({ extension: 'png' });
      const panelData = generateVcPanel(
        record.ownerId,
        record.coOwners,
        record.limit,
        record.isLocked,
        record.isHidden,
        avatarUrl
      );

      // Send the panel
      const panelMessage = await message.channel.send(panelData);

      // Update database with the new panel message ID
      record.panelMessageId = panelMessage.id;
      vcDatabase.saveVc(voiceChannel.id, record);

      // Clean up the invoke message to keep the channel tidy
      if (message.deletable) {
        await message.delete().catch(() => {});
      }
    } catch (err) {
      console.error('Error executing vcpanel command:', err);
    }
  }
};
