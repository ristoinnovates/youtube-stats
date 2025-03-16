const express = require('express');
const { google } = require('googleapis');

const app = express();
const PORT = 5000;

let youtubeData = {
  name: "Risto Innovates",
  subscribers: 2200,
  views: 150000,
  videoCount: 35,
  latestVideo: {
    title: 'How to use a diglypuff',
    views: 123000,
    comments: 5230
  }
};

let instagramData = {
  name: "Risto Innovates",
  subscribers: 89,
  views: 1230,
  videoCount: 42,
  latestVideo: {
    title: 'How to build pedals',
    views: 2100,
    comments: 30
  }
};

let tiktokData = {
  name: "Risto Innovates",
  subscribers: 2560,
  views: 200340,
  videoCount: 43,
  latestVideo: {
    title: 'Buildo pedalo',
    views: 234,
    comments: 23
  }
};

let finalData = {
  youtubeData,
  instagramData,
  tiktokData
};

// Set up OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// Set initial credentials if refresh token exists
if (process.env.YOUTUBE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });
}

// Create YouTube API client
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

// Function to refresh the access token
async function refreshAccessToken() {
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    console.log('Access token refreshed:', credentials.access_token);
  } catch (error) {
    console.error('Error refreshing access token:', error.response ? error.response.data : error);
  }
}

// Function to fetch YouTube stats
async function fetchYouTubeData() {
  try {
    await refreshAccessToken(); // Ensure fresh token before API calls

    // Fetch channel statistics
    const channelResponse = await youtube.channels.list({
      part: 'statistics',
      id: process.env.CHANNEL_ID,
    });

    if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
      console.error("No channel data found.");
      return;
    }

    const stats = channelResponse.data.items[0].statistics;
    youtubeData.subscribers = parseInt(stats.subscriberCount, 10);
    youtubeData.views = parseInt(stats.viewCount, 10);
    youtubeData.videoCount = parseInt(stats.videoCount, 10);

    // Fetch the latest video details
    const videosResponse = await youtube.search.list({
      part: 'snippet',
      channelId: process.env.CHANNEL_ID,
      maxResults: 1,
      order: 'date',
      type: 'video',
    });

    if (!videosResponse.data.items || videosResponse.data.items.length === 0) {
      console.error("No videos found.");
      return;
    }

    const latestVideoId = videosResponse.data.items[0].id.videoId;
    youtubeData.latestVideo.title = videosResponse.data.items[0].snippet.title;

    const videoDetailsResponse = await youtube.videos.list({
      part: 'statistics',
      id: latestVideoId,
    });

    if (!videoDetailsResponse.data.items || videoDetailsResponse.data.items.length === 0) {
      console.error("No video details found.");
      return;
    }

    const videoStats = videoDetailsResponse.data.items[0].statistics;
    youtubeData.latestVideo.views = parseInt(videoStats.viewCount, 10);
    youtubeData.latestVideo.comments = parseInt(videoStats.commentCount, 10);

    finalData.youtubeData = youtubeData; // Ensure finalData updates

    console.log('Updated YouTube Data:', youtubeData);
  } catch (error) {
    console.error('Error fetching YouTube data:', error.response ? error.response.data : error);
  }
}

// Schedule to fetch YouTube stats every 5 minutes
// setInterval(fetchYouTubeData, 300000); // 300,000 ms = 5 minutes
setInterval(fetchYouTubeData, 60000); // 60,000 ms = 1 minute
fetchYouTubeData(); // Initial fetch

// API endpoint for Wemos to fetch YouTube stats
app.get('/api/youtube-stats', (req, res) => {
  console.log(youtubeData);
  res.json(finalData);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`To authorize, visit: http://localhost:${PORT}/auth`);
});
