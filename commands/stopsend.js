const stoplink = require('./stoplink.js');

module.exports = {
  name: 'stopsend',
  description: 'Stop sending randomized links',
  async execute(message, args) {
    return stoplink.execute(message, args);
  }
};
