const axios = require('axios');

const target = process.argv[2] || `http://localhost:${process.env.YT_PORT || 3001}`;
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <entry>
    <id>yt:video:TEST_VIDEO_ID</id>
    <yt:videoId>TEST_VIDEO_ID</yt:videoId>
    <title>Test Video Title</title>
  </entry>
</feed>`;

(async () => {
  try {
    const res = await axios.post(`${target}/youtube/callback`, xml, {
      headers: { 'Content-Type': 'application/atom+xml' }
    });
    console.log('Notification response status', res.status);
    console.log('Response data:', res.data);
  } catch (err) {
    if (err.response) {
      console.error('Failed to send test notification', err.response.status, err.response.data);
    } else {
      console.error('Failed to send test notification', err.message || err);
    }
  }
})();
