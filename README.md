# Website-test

## Chess Move Endpoint (local)

This project includes a small local server that can receive move logs from the chess page.

Location:
- move-endpoint/

How to run:
1. Open a terminal in move-endpoint
2. Install dependencies: npm install
3. Start server: npm start

Default endpoint:
- http://localhost:8787/log-move

Useful checks:
- Health check: http://localhost:8787/health
- View recent logs: http://localhost:8787/logs

Optional API key:
1. Copy move-endpoint/.env.example to .env and set MOVE_API_KEY
2. Add the same key to requests using the x-api-key header

Notes:
- Logs are stored in move-endpoint/data/moves.log.jsonl
- The chess page is currently wired to the local endpoint in page31.html
