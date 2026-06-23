const express = require('express');
const app = express();
const PORT = 3000;

// List of Invidious instances to try in order
const INVIDIOUS_INSTANCES = [
  'https://invidious.nerdvpn.de',
  'https://invidious.f5.si',
  'https://yt.chocolatemoo53.com',
];

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// Try each instance until one works
async function fetchInvidious(path) {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const response = await fetch(`${base}${path}`);
      if (response.ok) return response.json();
    } catch (e) {
      console.log(`Instance ${base} failed: ${e.message}`);
    }
  }
  throw new Error('All Invidious instances failed');
}

function formatDuration(seconds) {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatViews(views) {
  if (!views) return "0";
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return String(views);
}

app.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Query required' });
  try {
    const data = await fetchInvidious(`/api/v1/search?q=${encodeURIComponent(query)}`);
    const results = data
      .filter(item => item.type === 'video')
      .map(item => ({
        videoId: item.videoId,
        title: item.title || 'Unknown',
        artist: item.author || 'Unknown Artist',
        thumbnailUrl: item.videoThumbnails?.find(t => t.quality === 'mqdefault')?.url
                      || `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`,
        duration: formatDuration(item.lengthSeconds),
        views: formatViews(item.viewCount)
      }))
      .slice(0, 15);
    res.json(results);
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: 'Search failed', message: error.message });
  }
});

app.get('/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;
  try {
    const data = await fetchInvidious(`/api/v1/videos/${videoId}`);
    const streams = data.formatStreams || [];
    if (streams.length === 0) throw new Error('No streams available');
    const audioOnly = streams.filter(s => s.type && s.type.includes('audio'));
    const streamUrl = audioOnly.length > 0 ? audioOnly[0].url : streams[streams.length - 1].url;
    res.json({
      videoId,
      streamUrl,
      title: data.title || 'Unknown',
      artist: data.author || 'Unknown Artist',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      duration: data.lengthSeconds || 0
    });
  } catch (error) {
    console.error('Stream error:', error.message);
    res.status(500).json({ error: 'Failed to get stream', message: error.message });
  }
});

const TRENDING_QUERIES = ['top hits 2024', 'bollywood hits 2024', 'trending songs today', 'new songs 2024', 'most popular songs'];

app.get('/trending', async (req, res) => {
  try {
    const query = TRENDING_QUERIES[Math.floor(Math.random() * TRENDING_QUERIES.length)];
    const data = await fetchInvidious(`/api/v1/search?q=${encodeURIComponent(query)}`);
    const results = data
      .filter(item => item.type === 'video')
      .map(item => ({
        videoId: item.videoId,
        title: item.title || 'Unknown',
        artist: item.author || 'Unknown Artist',
        thumbnailUrl: item.videoThumbnails?.find(t => t.quality === 'mqdefault')?.url
                      || `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`,
        duration: formatDuration(item.lengthSeconds),
        views: formatViews(item.viewCount)
      }))
      .slice(0, 15);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load trending', message: error.message });
  }
});

app.get('/proxy/:videoId', async (req, res) => {
  const { videoId } = req.params;
  try {
    const data = await fetchInvidious(`/api/v1/videos/${videoId}`);
    const streams = data.formatStreams || [];
    if (streams.length === 0) throw new Error('No streams');
    const audioOnly = streams.filter(s => s.type && s.type.includes('audio'));
    const streamUrl = audioOnly.length > 0 ? audioOnly[0].url : streams[streams.length - 1].url;
    res.redirect(streamUrl);
  } catch (error) {
    res.status(500).json({ error: 'Proxy failed' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'PLAY Music Backend', port: PORT });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🎵 PLAY Music Backend running!');
});
