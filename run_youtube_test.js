require('dotenv').config();
const yt = require('./youtube');

// minimal mock client that logs announcements to console
const mockClient = {
  channels: {
    fetch: async (id) => ({ send: (m) => console.log('[mock announce to channel]', id, m) })
  },
  guilds: {
    cache: {
      first: () => ({
        channels: { cache: { find: () => ({ send: (m) => console.log('[mock announce to guild channel]', m) }) } },
        members: { me: {} }
      })
    }
  }
};

yt.init(mockClient).then(() => {
  console.log('YouTube test server initialized');
}).catch(err => {
  console.error('YouTube init failed', err);
});
