const axios = require('axios');

const targetUrl = process.argv[2] || process.env.PUBLIC_URL || 'https://curly-paws-speak.loca.lt';
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <entry>
    <id>yt:video:TEST_VIDEO_ID</id>
    <yt:videoId>TEST_VIDEO_ID</yt:videoId>
    <title>Test Notification</title>
  </entry>
</feed>`;

(async () => {
  try {
    const res = await axios.post(`${targetUrl}/youtube/callback`, xml, {
      headers: { 'Content-Type': 'application/atom+xml' }
    });
    console.log(res.status, res.data);
  } catch (err) {
    if (err.response) {
      console.error('HTTP', err.response.status, err.response.data);
    } else {
      console.error(err.message);
    }
    process.exit(1);
  }
})();
