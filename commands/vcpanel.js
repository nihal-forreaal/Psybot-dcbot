const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

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

    // Create Premium VC Panel Embed
    const embed = new EmbedBuilder()
      .setTitle('🎙️ Voice Channel Control Center')
      .setDescription(
        'Welcome to your dynamic voice channel dashboard! Use the buttons below or ' +
        'the quick commands to control access, manage members, and configure your room.\n\n' +
        `👑 **Room Owner:** ${message.author}\n` +
        `👥 **Co-Owners:** *None*\n` +
        `🔢 **Limit:** \`Unlimited\``
      )
      .setColor('#00d0ff') // Cyber cyan premium accent
      .addFields(
        {
          name: '🛠️ Quick Chat Commands',
          value:
            '• `!kick @user` — Kick a user from your channel\n' +
            '• `!own2 @user` — Promote a user to co-owner\n' +
            '• `!access @user` — Grant specific access to a user\n' +
            '• `!block @user` — Block a user from joining',
          inline: false,
        }
      )
      .setFooter({ text: 'Psybot Room Manager', iconURL: message.client.user.displayAvatarURL() })
      .setTimestamp();

    // Create styled buttons
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
        .setStyle(ButtonStyle.Primary)
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
        .setStyle(ButtonStyle.Success)
        .setEmoji('🔓'),
      new ButtonBuilder()
        .setCustomId(`vc_block_${userId}`)
        .setLabel('Block User')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⛔')
    );

    await message.reply({ embeds: [embed], components: [row1, row2] });
  }
};
