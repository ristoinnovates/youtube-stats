const express = require('express');
const { google } = require('googleapis');
const dotenv = require('dotenv');
dotenv.config({ path: './config.env' });

const app = express();
const PORT = 5000;

let youtubeData = {
  name: "Risto Innovates",
  subscribers: 0,
  views: 0,
  videoCount: 0,
  latestVideo: {
    title: '',
    views: 0,
    comments: 0
  },
  unrespondedComments: 0
};

// Set up OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// Initial credentials if you already have the refresh token
if (process.env.YOUTUBE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });
}

const youtube = google.youtube({
  version: 'v3',
  auth: oauth2Client,
});

// Route to start the authorization flow
app.get('/auth', (req, res) => {
  console.log("Client ID:", process.env.YOUTUBE_CLIENT_ID);
  console.log("Redirect URI:", process.env.REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/youtube.readonly'],
    prompt: 'consent',
  });
  res.redirect(authUrl);
});

// OAuth2 callback to handle authorization and save refresh token
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Store the refresh token for future use
    console.log('Access Token:', tokens.access_token);
    console.log('Refresh Token:', tokens.refresh_token); // Save this securely

    res.send('Authorization successful! You can now access YouTube data.');
  } catch (error) {
    console.error('Error retrieving access token:', error);
    res.status(500).send('Error retrieving access token');
  }
});

// Function to fetch YouTube stats
async function fetchYouTubeData() {
  try {
    // Fetch channel statistics
    const channelResponse = await youtube.channels.list({
      part: 'statistics',
      id: process.env.CHANNEL_ID,
    });
    const stats = channelResponse.data.items[0].statistics;
    
    youtubeData.subscribers = stats.subscriberCount;
    youtubeData.views = stats.viewCount;
    youtubeData.videoCount = stats.videoCount;

    // Fetch the latest video details
    const videosResponse = await youtube.search.list({
      part: 'snippet',
      channelId: process.env.CHANNEL_ID,
      maxResults: 1,
      order: 'date',
      type: 'video',
    });
    const latestVideoId = videosResponse.data.items[0].id.videoId;
    youtubeData.latestVideo.title = videosResponse.data.items[0].snippet.title;

    const videoDetailsResponse = await youtube.videos.list({
      part: 'statistics',
      id: latestVideoId,
    });
    const videoStats = videoDetailsResponse.data.items[0].statistics;
    youtubeData.latestVideo.views = videoStats.viewCount;
    youtubeData.latestVideo.comments = videoStats.commentCount;

    // Calculate unresponded comments if necessary (requires more complex logic)
    youtubeData.unrespondedComments = calculateUnrespondedComments(latestVideoId);

    console.log('Updated YouTube Data:', youtubeData);
  } catch (error) {
    console.error('Error fetching YouTube data:', error);
  }
}

// Function to calculate unresponded comments (stub for example purposes)
function calculateUnrespondedComments(videoId) {
  // This function could integrate additional API logic to check comment responses.
  // As a placeholder, assume all comments are unresponded for simplicity.
  return youtubeData.latestVideo.comments;
}

// Schedule to fetch YouTube stats every 5 minutes
setInterval(fetchYouTubeData, 300000); // 300,000 ms = 5 minutes
fetchYouTubeData(); // Initial fetch

// Endpoint for Wemos to fetch YouTube stats
app.get('/api/youtube-stats', (req, res) => {
  console.log(youtubeData);
  res.json(youtubeData);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`To authorize, visit: http://localhost:${PORT}/auth`);
});
