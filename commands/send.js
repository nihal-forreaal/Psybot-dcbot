const startlink = require('./startlink.js');

module.exports = {
  name: 'send',
  description: 'Start sending a link with its last X characters randomized at a specified interval',
  async execute(message, args) {
    return startlink.execute(message, args);
  }
};
