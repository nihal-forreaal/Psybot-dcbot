const fs = require('fs');
const path = require('path');
const localtunnel = require('localtunnel');

const port = parseInt(process.env.YT_PORT, 10) || 3000;
const urlFile = path.join(__dirname, 'tunnel.url');

(async () => {
  const tunnel = await localtunnel({ port });
  console.log(tunnel.url);
  fs.writeFileSync(urlFile, tunnel.url, 'utf8');

  process.on('SIGINT', async () => {
    await tunnel.close();
    process.exit(0);
  });
  // keep the tunnel open until manually stopped
})();
