const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
  name: 'vcpanel',
  description: 'Show VC management panel for your voice channel',
  async execute(message) {
    // Check if user is in a voice channel
    if (!message.member.voice.channel) {
      return message.reply('❌ You must be in a voice channel to use this command.');
    }

    const voiceChannel = message.member.voice.channel;
    const userId = message.author.id;

    // Check if it's a temp VC (owned by the user)
    if (!voiceChannel.name.includes(message.author.username)) {
      return message.reply('❌ You can only manage your own voice channel.');
    }

    // Create VC Panel Embed
    const embed = new EmbedBuilder()
      .setTitle('🎙️ Custom VC Panel')
      .setDescription('Use the buttons below to control your voice channel:')
      .setColor('#5865F2')
      .addFields(
        { name: '✅ VC Owner', value: `${message.author.tag}`, inline: true },
        { name: '👥 Co Owners', value: 'None', inline: true },
        { name: '🔢 VC Limit', value: '∞ (Unlimited)', inline: true },
        {
          name: 'Quick Commands',
          value: '`!kick @person` - kick user\n`!own2 @person` - add co-owner\n`!access @person` - allow user\n`!block @person` - block user',
          inline: false,
        }
      )
      .setFooter({ text: 'Click buttons to manage your VC' });

    // Create buttons
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

    await message.reply({ embeds: [embed], components: [row1, row2] });
  }
};
