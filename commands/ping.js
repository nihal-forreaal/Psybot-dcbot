module.exports = {
  name: 'ping',
  description: 'Replies with Pong and latency',
  async execute(message) {
    const sent = await message.reply('Pong...');
    const latency = sent.createdTimestamp - message.createdTimestamp;
    sent.edit(`Pong! Latency: ${latency}ms`);
  }
};
