/**
 * PLAY Music Backend Server
 * -------------------------
 * Node.js + Express server that uses yt-dlp to:
 * - Search YouTube for songs
 * - Return audio-only stream URLs (Opus/WebM, ~130kbps)
 * - NO video data — low bandwidth, works on slow connections
 * 
 * Run: npm install && node server.js
 */

const express = require('express');
const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

const YTDLP = process.platform === 'win32'
  ? path.join(__dirname, 'yt-dlp.exe')
  : 'yt-dlp';

function ytdlp(args) {
  return new Promise((resolve, reject) => {
    exec(`"${YTDLP}" ${args}`, { maxBuffer: 10 * 1024 * 1024, timeout: 30000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout.trim());
    });
  });
}

// ─── Search ───────────────────────────────────────────────────────────────────
app.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Query required' });

  try {
    // Search YouTube, get top 15 results as JSON
    const raw = await ytdlp(
      `"ytsearch15:${query.replace(/"/g, '')}" --dump-json --flat-playlist --no-warnings --no-check-certificates --no-playlist`
    );

    const lines = raw.split('\n').filter(Boolean);
    const results = lines.map(line => {
      try {
        const info = JSON.parse(line);
        return {
          videoId: info.id,
          title: info.title || 'Unknown',
          artist: info.channel || info.uploader || 'Unknown Artist',
          thumbnailUrl: `https://i.ytimg.com/vi/${info.id}/mqdefault.jpg`,
          duration: formatDuration(info.duration || 0),
          views: formatViews(info.view_count || 0)
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

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
    // Get audio-only stream info (Opus/WebM — no video data!)
    const raw = await ytdlp(
      `https://www.youtube.com/watch?v=${videoId} -f "bestaudio[ext=webm]/bestaudio/best" --get-url --no-warnings --no-check-certificates --no-playlist`
    );

    const streamUrl = raw.split('\n')[0].trim();

    // Also get metadata
    const metaRaw = await ytdlp(
      `https://www.youtube.com/watch?v=${videoId} --dump-json --no-warnings --no-check-certificates --no-playlist --skip-download`
    );
    const meta = JSON.parse(metaRaw);

    res.json({
      videoId,
      streamUrl,
      title: meta.title || 'Unknown',
      artist: meta.channel || meta.uploader || 'Unknown Artist',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      duration: meta.duration || 0
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
    const raw = await ytdlp(
      `"ytsearch20:${query}" --dump-json --flat-playlist --no-warnings --no-check-certificates --no-playlist`
    );
    const lines = raw.split('\n').filter(Boolean);
    const results = lines.map(line => {
      try {
        const info = JSON.parse(line);
        return {
          videoId: info.id,
          title: info.title || 'Unknown',
          artist: info.channel || info.uploader || 'Unknown Artist',
          thumbnailUrl: `https://i.ytimg.com/vi/${info.id}/mqdefault.jpg`,
          duration: formatDuration(info.duration || 0),
          views: formatViews(info.view_count || 0)
        };
      } catch (e) { return null; }
    }).filter(Boolean);

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load trending' });
  }
});

// ─── Audio Proxy (optional — streams audio via server for CORS) ───────────────
app.get('/proxy/:videoId', async (req, res) => {
  const { videoId } = req.params;
  try {
    const raw = await ytdlp(
      `https://www.youtube.com/watch?v=${videoId} -f "bestaudio[ext=webm]/bestaudio/best" --get-url --no-warnings --no-check-certificates`
    );
    const streamUrl = raw.split('\n')[0].trim();
    res.redirect(streamUrl);
  } catch (error) {
    res.status(500).json({ error: 'Proxy failed' });
  }
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'PLAY Music Backend', port: PORT });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatViews(views) {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return String(views);
}

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🎵 PLAY Music Backend running!');
  console.log(`   Local:    http://localhost:${PORT}`);
  console.log(`   Network:  http://[your-ip]:${PORT}`);
  console.log('\n   For Android Emulator: already configured (10.0.2.2)');
  console.log('   For Real Device: set your PC IP in ApiClient.kt\n');
});
