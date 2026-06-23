/**
 * PLAY Music Backend Server
 * -------------------------
 * Node.js + Express server that acts as a proxy to the Invidious API
 * - Completely immune to YouTube datacenter blocks
 * - No yt-dlp dependencies needed
 */

const express = require('express');
const app = express();
const PORT = 3000;

// The public API instance we are using
const INVIDIOUS_URL = 'https://inv.thepixora.com';

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── Search ───────────────────────────────────────────────────────────────────
app.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Query required' });

  try {
    const response = await fetch(`${INVIDIOUS_URL}/api/v1/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    
    const data = await response.json();
    
    // Format the response to match our Android app's expectations
    const results = data
      .filter(item => item.type === 'video')
      .map(item => ({
        videoId: item.videoId,
        title: item.title || 'Unknown',
        artist: item.author || 'Unknown Artist',
        thumbnailUrl: item.videoThumbnails?.find(t => t.quality === 'mqdefault')?.url 
                      || item.videoThumbnails?.[0]?.url 
                      || `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`,
        duration: formatDuration(item.lengthSeconds),
        views: formatViews(item.viewCount)
      }))
      .slice(0, 15); // limit to 15 results

    res.json(results);
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: 'Search failed', message: error.message });
  }
});

// ─── Get Audio Stream URL ─────────────────────────────────────────────────────
app.get('/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;

  try {
    const response = await fetch(`${INVIDIOUS_URL}/api/v1/videos/${videoId}`);
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    
    const data = await response.json();
    
    // Find the best audio-only stream (preferably opus/webm)
    const audioStreams = data.formatStreams || [];
    let streamUrl = '';
    
    if (audioStreams.length > 0) {
        // Try to get audio-only streams
        const audioOnly = audioStreams.filter(s => s.type && s.type.includes('audio'));
        if (audioOnly.length > 0) {
            streamUrl = audioOnly[0].url;
        } else {
            // Fallback to the lowest quality video if no audio-only stream is found
            streamUrl = audioStreams[audioStreams.length - 1].url;
        }
    } else {
        throw new Error('No audio streams available for this video');
    }

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

// ─── Trending ─────────────────────────────────────────────────────────────────
const TRENDING_QUERIES = [
  'top hits 2024',
  'bollywood hits 2024',
  'trending songs today',
  'new songs 2024',
  'most popular songs'
];

app.get('/trending', async (req, res) => {
  try {
    const query = TRENDING_QUERIES[Math.floor(Math.random() * TRENDING_QUERIES.length)];
    const response = await fetch(`${INVIDIOUS_URL}/api/v1/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    
    const data = await response.json();
    
    const results = data
      .filter(item => item.type === 'video')
      .map(item => ({
        videoId: item.videoId,
        title: item.title || 'Unknown',
        artist: item.author || 'Unknown Artist',
        thumbnailUrl: item.videoThumbnails?.find(t => t.quality === 'mqdefault')?.url 
                      || item.videoThumbnails?.[0]?.url 
                      || `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`,
        duration: formatDuration(item.lengthSeconds),
        views: formatViews(item.viewCount)
      }))
      .slice(0, 15);

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load trending' });
  }
});

// ─── Audio Proxy ──────────────────────────────────────────────────────────────
app.get('/proxy/:videoId', async (req, res) => {
  const { videoId } = req.params;
  try {
    const response = await fetch(`${INVIDIOUS_URL}/api/v1/videos/${videoId}`);
    const data = await response.json();
    
    const audioStreams = data.formatStreams || [];
    let streamUrl = '';
    
    if (audioStreams.length > 0) {
        const audioOnly = audioStreams.filter(s => s.type && s.type.includes('audio'));
        streamUrl = audioOnly.length > 0 ? audioOnly[0].url : audioStreams[audioStreams.length - 1].url;
    } else {
        throw new Error('No streams');
    }
    
    res.redirect(streamUrl);
  } catch (error) {
    res.status(500).json({ error: 'Proxy failed' });
  }
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'PLAY Music Backend', port: PORT });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🎵 PLAY Music Backend running (Invidious API Mode)!');
  console.log(`   Network:  http://[your-ip]:${PORT}`);
});
