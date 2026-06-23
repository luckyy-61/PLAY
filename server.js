/**
 * PLAY Music Backend Server
 * -------------------------
 * Uses yt-dlp with YouTube cookies for authenticated streaming.
 * Cookies are loaded from YT_COOKIES environment variable (set in Render dashboard).
 */

const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3000;
const COOKIES_PATH = path.join(os.tmpdir(), 'yt_cookies.txt');

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// ─── Write cookies from environment variable to a temp file ───────────────────
function setupCookies() {
  const cookieData = process.env.YT_COOKIES;
  if (cookieData) {
    fs.writeFileSync(COOKIES_PATH, cookieData, 'utf8');
    console.log('✅ YouTube cookies loaded from environment variable.');
  } else {
    console.warn('⚠️  YT_COOKIES environment variable not set. Streams may fail.');
  }
}

// ─── yt-dlp wrapper ───────────────────────────────────────────────────────────
function ytdlp(args) {
  const cookieArg = fs.existsSync(COOKIES_PATH) ? `--cookies "${COOKIES_PATH}"` : '';
  const cmd = `yt-dlp ${cookieArg} ${args}`;
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 10 * 1024 * 1024, timeout: 45000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout.trim());
    });
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatViews(views) {
  if (!views) return '0';
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return String(views);
}

// ─── Search ───────────────────────────────────────────────────────────────────
app.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Query required' });
  try {
    const raw = await ytdlp(
      `"ytsearch15:${query.replace(/"/g, '')}" --dump-json --flat-playlist --no-warnings --no-playlist`
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
    console.error('Search error:', error.message);
    res.status(500).json({ error: 'Search failed', message: error.message });
  }
});

// ─── Stream ───────────────────────────────────────────────────────────────────
app.get('/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;
  try {
    const raw = await ytdlp(
      `https://www.youtube.com/watch?v=${videoId} -f ba --get-url --no-warnings --no-playlist`
    );
    const streamUrl = raw.split('\n')[0].trim();

    const metaRaw = await ytdlp(
      `https://www.youtube.com/watch?v=${videoId} --dump-json --no-warnings --no-playlist --skip-download`
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
  'top hits 2025', 'bollywood hits 2025', 'trending songs today',
  'new songs 2025', 'most popular songs'
];

app.get('/trending', async (req, res) => {
  try {
    const query = TRENDING_QUERIES[Math.floor(Math.random() * TRENDING_QUERIES.length)];
    const raw = await ytdlp(
      `"ytsearch20:${query}" --dump-json --flat-playlist --no-warnings --no-playlist`
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

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'PLAY Music Backend',
    cookies: fs.existsSync(COOKIES_PATH) ? 'loaded' : 'missing'
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
setupCookies();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎵 PLAY Music Backend running on port ${PORT}`);
});
