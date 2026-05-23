const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'aipanel',
  description: 'Spawn the private AI chat creation portal (admin only)',
  async execute(message) {
    const isAdminRole = message.member.roles.cache.has(process.env.ADMIN_ROLE_ID);
    const hasAdminPerm = message.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isAdminRole && !hasAdminPerm) {
      return message.reply('❌ Only admins can spawn the AI Panel.');
    }

    const embed = new EmbedBuilder()
      .setTitle('🤖 Psybot Premium AI Portal')
      .setDescription(
        'Click the button below to instantiate your own **Private AI Chat Channel**.\n\n' +
        '🟢 **Features:**\n' +
        '• Completely private (only you and Psybot have access)\n' +
        '• Direct, natural chatting powered by **Psybot AI**\n' +
        '• Full support for code formatting, formatting styles, and questions\n\n' +
        '⚠️ **Inactivity Cleanup:**\n' +
        '• To conserve server resources, each private channel will **automatically self-destruct after 1 hour of inactivity**.\n' +
        '• A gentle warning reminder will be sent in the channel at **50 minutes** of silence.'
      )
      .setColor('#00d0ff')
      .setFooter({ text: 'Psybot Private AI Instance Router', iconURL: message.client.user.displayAvatarURL() })
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId('create_ai_chat')
      .setLabel('💬 Create Private AI Chat')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(button);

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete().catch(() => {});
  },
};
