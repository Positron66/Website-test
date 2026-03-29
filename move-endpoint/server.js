const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8787;
const API_KEY = process.env.MOVE_API_KEY || '';

const dataDir = path.join(__dirname, 'data');
const logFile = path.join(dataDir, 'moves.log.jsonl');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));

function authFailed(req) {
  if (!API_KEY) return false;
  return req.header('x-api-key') !== API_KEY;
}

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'arg-move-endpoint' });
});

app.post('/log-move', (req, res) => {
  if (authFailed(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ ok: false, error: 'Invalid JSON payload' });
  }

  const record = {
    receivedAt: new Date().toISOString(),
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null,
    payload
  };

  fs.appendFileSync(logFile, JSON.stringify(record) + '\n', 'utf8');
  return res.json({ ok: true });
});
app.get('/log-move', (req, res) => {
	if (authFailed(req)) {
		return res.status(401).json({ ok: false, error: 'Unauthorized' });
	}

	if (!fs.existsSync(logFile)) {
		return res.json({ board: {}, moves: [], game: {} });
	}

	const lines = fs.readFileSync(logFile, 'utf8')
		.split('\n')
		.filter(Boolean);

	if (lines.length === 0) {
		return res.json({ board: {}, moves: [], game: {} });
	}

	const lastLine = lines[lines.length - 1];
	try {
		const record = JSON.parse(lastLine);
		if (record && record.payload) {
			return res.json({
				board: record.payload.board || {},
				moves: record.payload.moves || [],
				game: record.payload.game || {}
			});
		}
	} catch (error) {
		// Parse error, return empty state
	}

	return res.json({ board: {}, moves: [], game: {} });
});
app.get('/logs', (req, res) => {
  if (authFailed(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  if (!fs.existsSync(logFile)) {
    return res.json({ ok: true, records: [] });
  }

  const lines = fs.readFileSync(logFile, 'utf8')
    .split('\n')
    .filter(Boolean)
    .slice(-200);

  const records = lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  }).filter(Boolean);

  return res.json({ ok: true, records });
});

app.listen(PORT, () => {
  console.log(`Move endpoint listening on http://localhost:${PORT}`);
  console.log('POST /log-move to record moves');
  console.log('GET  /logs to inspect recent entries');
});
