module.exports = {
  name: 'say',
  description: 'Bot repeats your message',
  async execute(message, args) {
    if (!args.length) return message.reply('Please provide a message to say.');
    const text = args.join(' ');
    message.channel.send(text);
  }
};
