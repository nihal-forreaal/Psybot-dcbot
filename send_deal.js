require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const channelId = '1501237193996501003';
  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (!channel) {
    console.error('❌ Channel not found!');
    return client.destroy();
  }

  const embed = new EmbedBuilder()
    .setColor('#C51111') // Among Us Impostor Red
    .setTitle('<:amongus:> 🚨 LIMITED DEAL — Among Us on PC!')
    .setDescription(
      `> *One of us... has a deal this good.* 🕵️\n\n` +
      `**Among Us** is available right now on the **Microsoft Store** for an unbeatable price!\n\n` +
      `Play with friends online or locally — find the Impostors before it's too late!\n\n` +
      `─────────────────────────────`
    )
    .addFields(
      {
        name: '🏷️ Price',
        value: '## ₹161 only!',
        inline: true
      },
      {
        name: '🛒 Platform',
        value: 'Microsoft Store (PC / Xbox)',
        inline: true
      },
      {
        name: '👥 Players',
        value: '4 – 15 Players',
        inline: true
      },
      {
        name: '✨ Features',
        value:
          '▪️ Cross-play with mobile & console\n' +
          '▪️ Multiple maps: Skeld, Mira HQ, Polus & more\n' +
          '▪️ Cosmetics, pets & hats\n' +
          '▪️ Voice chat & custom lobbies',
        inline: false
      }
    )
    .setImage('https://store-images.s-microsoft.com/image/apps.63208.14391172489219718.b4744f40-5fdc-4e81-b90b-b37a9c2fdf07.f5d9fa96-0bf0-4b40-875f-23b15f1b8b22')
    .setFooter({
      text: 'Psybot Gaming Deals • Click the button below to grab it!',
      iconURL: client.user.displayAvatarURL()
    })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('🛒 Buy on Microsoft Store')
      .setStyle(ButtonStyle.Link)
      .setURL('https://apps.microsoft.com/detail/9NG07QJNK38J?hl=en&gl=IN'),
    new ButtonBuilder()
      .setLabel('🎮 Among Us Official Site')
      .setStyle(ButtonStyle.Link)
      .setURL('https://www.innersloth.com/games/among-us/')
  );

  await channel.send({ embeds: [embed], components: [row] });
  console.log('✅ Message sent successfully!');
  client.destroy();
});

client.login(process.env.TOKEN);
