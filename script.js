document.addEventListener('DOMContentLoaded', function () {
	const turnButtons = document.querySelectorAll('.turn');

	// No automatic speech: user requested speech disabled.
	// Buttons navigate when they have a `data-target` attribute.
	turnButtons.forEach(btn => {
		btn.addEventListener('click', function () {
			const target = btn.getAttribute('data-target');
			if (target) {
				window.location.href = target;
				return;
			}

			// Fallback: if no target, try history back for "back" buttons
			if (btn.classList.contains('back')) {
				if (window.history.length > 1) window.history.back();
			}
		});
	});

	// Audio toggle on standalone pages
	const audio = document.getElementById('bg-audio');
	const audioToggle = document.querySelector('.audio-toggle');
	if (audio && audioToggle) {
		// ensure preload is none; user must opt-in
		audioToggle.addEventListener('click', function () {
			if (audio.paused) {
				// start
				audio.play().then(() => {
					audioToggle.classList.add('playing');
					audioToggle.setAttribute('aria-pressed', 'true');
					audioToggle.setAttribute('aria-label', 'Pause audio');
				}).catch(() => {
					// play rejected (autoplay policy). still toggle UI so user can try again
					audioToggle.classList.add('playing');
					audioToggle.setAttribute('aria-pressed', 'true');
					audioToggle.setAttribute('aria-label', 'Pause audio');
				});
			} else {
				audio.pause();
				audioToggle.classList.remove('playing');
				audioToggle.setAttribute('aria-pressed', 'false');
				audioToggle.setAttribute('aria-label', 'Play audio');
			}
		});

		// Sync button when audio ends
		audio.addEventListener('ended', function () {
			audioToggle.classList.remove('playing');
			audioToggle.setAttribute('aria-pressed', 'false');
			audioToggle.setAttribute('aria-label', 'Play audio');
		});
	}

	initializeChessBoard();
});

function initializeChessBoard() {
	const boardEl = document.getElementById('chess-board');
	if (!boardEl) return;

	const moveListEl = document.getElementById('chess-move-list');
	const resetBtn = document.getElementById('chess-reset');
	const copyLogBtn = document.getElementById('chess-copy-log');
	const statusEl = document.getElementById('chess-status');
	const endpointMeta = document.querySelector('meta[name="chess-log-endpoint"]');
	const endpoint = (endpointMeta && endpointMeta.content ? endpointMeta.content.trim() : '') || boardEl.dataset.endpoint || '';

	const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
	const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
	const pieceGlyphs = {
		K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
		k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
	};
	const storageKey = 'arg_chess_state_v1';
	const moveKey = 'arg_chess_moves_v1';

	let board = loadBoardState() || getInitialBoard();
	let moves = loadMoves();
	let selectedSquare = null;

	renderBoard();
	renderMoveList();
	updateStatus(endpoint ? 'Live logging enabled.' : 'Local-only logging (no endpoint set).');

	if (resetBtn) {
		resetBtn.addEventListener('click', function () {
			board = getInitialBoard();
			moves = [];
			selectedSquare = null;
			persist();
			renderBoard();
			renderMoveList();
			updateStatus(endpoint ? 'Board reset and synced locally.' : 'Board reset locally.');
		});
	}

	if (copyLogBtn) {
		copyLogBtn.addEventListener('click', async function () {
			const payload = JSON.stringify(buildLogPayload(), null, 2);
			try {
				await navigator.clipboard.writeText(payload);
				updateStatus('Move log copied to clipboard.');
			} catch (error) {
				updateStatus('Clipboard blocked. You can still copy from the move list.');
			}
		});
	}

	function getInitialBoard() {
		return {
			a8: 'r', b8: 'n', c8: 'b', d8: 'q', e8: 'k', f8: 'b', g8: 'n', h8: 'r',
			a7: 'p', b7: 'p', c7: 'p', d7: 'p', e7: 'p', f7: 'p', g7: 'p', h7: 'p',
			a2: 'P', b2: 'P', c2: 'P', d2: 'P', e2: 'P', f2: 'P', g2: 'P', h2: 'P',
			a1: 'R', b1: 'N', c1: 'B', d1: 'Q', e1: 'K', f1: 'B', g1: 'N', h1: 'R'
		};
	}

	function loadBoardState() {
		try {
			const raw = localStorage.getItem(storageKey);
			if (!raw) return null;
			const parsed = JSON.parse(raw);
			if (!parsed || typeof parsed !== 'object') return null;
			return parsed;
		} catch (error) {
			return null;
		}
	}

	function loadMoves() {
		try {
			const raw = localStorage.getItem(moveKey);
			if (!raw) return [];
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : [];
		} catch (error) {
			return [];
		}
	}

	function persist() {
		localStorage.setItem(storageKey, JSON.stringify(board));
		localStorage.setItem(moveKey, JSON.stringify(moves));
	}

	function renderBoard() {
		boardEl.innerHTML = '';

		ranks.forEach(rank => {
			files.forEach((file, fileIdx) => {
				const square = file + rank;
				const isLight = (fileIdx + rank) % 2 === 0;
				const cell = document.createElement('button');
				cell.type = 'button';
				cell.className = 'chess-square ' + (isLight ? 'light' : 'dark');
				cell.dataset.square = square;
				cell.setAttribute('aria-label', 'Square ' + square);

				const piece = board[square] || '';
				if (piece) {
					cell.textContent = pieceGlyphs[piece] || '';
					cell.dataset.piece = piece;
				}

				if (selectedSquare === square) {
					cell.classList.add('selected');
				}

				cell.addEventListener('click', function () {
					onSquareClick(square);
				});
				boardEl.appendChild(cell);
			});
		});
	}

	function onSquareClick(square) {
		const piece = board[square];

		if (!selectedSquare) {
			if (!piece) return;
			selectedSquare = square;
			renderBoard();
			return;
		}

		if (selectedSquare === square) {
			selectedSquare = null;
			renderBoard();
			return;
		}

		const movingPiece = board[selectedSquare];
		if (!movingPiece) {
			selectedSquare = null;
			renderBoard();
			return;
		}

		const capturedPiece = board[square] || null;
		board[square] = movingPiece;
		delete board[selectedSquare];

		const move = {
			from: selectedSquare,
			to: square,
			piece: movingPiece,
			captured: capturedPiece,
			timestamp: new Date().toISOString()
		};

		moves.push(move);
		selectedSquare = null;
		persist();
		renderBoard();
		renderMoveList();
		sendMoveToEndpoint(move);
	}

	function renderMoveList() {
		if (!moveListEl) return;
		if (moves.length === 0) {
			moveListEl.textContent = 'No moves yet.';
			return;
		}

		const lines = moves.map((move, index) => {
			const action = move.captured ? 'x' : '-';
			return (index + 1) + '. ' + move.piece + ' ' + move.from + action + move.to;
		});
		moveListEl.textContent = lines.join('\n');
	}

	function buildLogPayload(lastMove) {
		return {
			page: window.location.pathname,
			lastMove: lastMove || null,
			moves: moves,
			board: board,
			updatedAt: new Date().toISOString()
		};
	}

	async function sendMoveToEndpoint(move) {
		if (!endpoint) return;
		try {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildLogPayload(move))
			});

			if (!response.ok) {
				updateStatus('Move saved locally. Remote log failed (' + response.status + ').');
				return;
			}

			updateStatus('Move logged remotely and locally.');
		} catch (error) {
			updateStatus('Move saved locally. Remote endpoint unreachable.');
		}
	}

	function updateStatus(message) {
		if (statusEl) statusEl.textContent = message;
	}
}