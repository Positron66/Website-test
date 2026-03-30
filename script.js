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

	let shakeTimer = null;
	const wrongSoundBase = new Audio('Assests/Sound/wrongsound.mp3');
	wrongSoundBase.preload = 'auto';
	document.addEventListener('click', function (event) {
		const redacted = event.target.closest('.redacted-word');
		if (!redacted) return;

		// Clone the audio node so repeated clicks can overlap naturally.
		const clickSound = wrongSoundBase.cloneNode(true);
		clickSound.currentTime = 0;
		clickSound.play().catch(function () {
			// Ignore blocked playback errors; interaction usually allows it.
		});

		document.body.classList.remove('screen-shake');
		void document.body.offsetWidth;
		document.body.classList.add('screen-shake');

		if (shakeTimer) clearTimeout(shakeTimer);
		shakeTimer = setTimeout(function () {
			document.body.classList.remove('screen-shake');
		}, 420);
	});

	initializeChessAccessGate(initializeChessBoard);
});

function initializeChessAccessGate(onUnlock) {
	const gate = document.getElementById('chess-access-gate');
	if (!gate) {
		onUnlock();
		return;
	}

	const input = document.getElementById('chess-access-input');
	const submit = document.getElementById('chess-access-submit');
	const error = document.getElementById('chess-access-error');
	const page = document.querySelector('.page.chess-entry');
	const sessionKey = 'arg_chess_unlocked_v1';
	const requiredCode = 'testside1';

	function unlockAndStart() {
		if (page) page.classList.remove('chess-locked');
		gate.hidden = true;
		if (error) error.textContent = '';
		sessionStorage.setItem(sessionKey, 'true');
		onUnlock();
	}

	if (sessionStorage.getItem(sessionKey) === 'true') {
		unlockAndStart();
		return;
	}

	if (page) page.classList.add('chess-locked');
	gate.hidden = false;
	if (input) input.focus();

	function checkCode() {
		const value = input ? input.value.trim() : '';
		if (value === requiredCode) {
			unlockAndStart();
			return;
		}
		if (error) error.textContent = 'Wrong code. Try again.';
	}

	if (submit) {
		submit.addEventListener('click', function () {
			checkCode();
		});
	}

	if (input) {
		input.addEventListener('keydown', function (event) {
			if (event.key === 'Enter') {
				event.preventDefault();
				checkCode();
			}
		});
	}
}

async function fetchRemoteChessState(endpoint) {
	if (!endpoint) return null;
	try {
		const response = await fetch(endpoint, { 
			method: 'GET',
			headers: { 'Accept': 'application/json' }
		});
		if (!response.ok) return null;
		const data = await response.json();
		return (data && typeof data === 'object') ? data : null;
	} catch (error) {
		return null;
	}
}

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
	const gameKey = 'arg_chess_game_v1';

	let board = loadBoardState() || getInitialBoard();
	let moves = loadMoves();
	let game = loadGameState();
	let selectedSquare = null;

	renderBoard();
	renderMoveList();
	updateTurnStatus();

	if (endpoint) {
		fetchRemoteChessState(endpoint).then(remoteState => {
			if (remoteState && remoteState.board && typeof remoteState.board === 'object') {
				board = remoteState.board;
				moves = Array.isArray(remoteState.moves) ? remoteState.moves : [];
				if (remoteState.game && typeof remoteState.game === 'object') {
					game = remoteState.game;
				}
				selectedSquare = null;
				renderBoard();
				renderMoveList();
				updateTurnStatus();
			}
		});
	}

	if (resetBtn) {
		resetBtn.addEventListener('click', function () {
			board = getInitialBoard();
			moves = [];
			game = getInitialGameState();
			selectedSquare = null;
			persist();
			renderBoard();
			renderMoveList();
			updateTurnStatus(endpoint ? 'Board reset. Live logging enabled.' : 'Board reset.');
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

	function getInitialGameState() {
		return {
			turn: 'w',
			castling: { K: true, Q: true, k: true, q: true },
			enPassant: null,
			halfmove: 0,
			fullmove: 1
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

	function loadGameState() {
		const defaults = getInitialGameState();
		try {
			const raw = localStorage.getItem(gameKey);
			if (!raw) return defaults;
			const parsed = JSON.parse(raw);
			if (!parsed || typeof parsed !== 'object') return defaults;
			return {
				turn: parsed.turn === 'b' ? 'b' : 'w',
				castling: {
					K: !(parsed.castling && parsed.castling.K === false),
					Q: !(parsed.castling && parsed.castling.Q === false),
					k: !(parsed.castling && parsed.castling.k === false),
					q: !(parsed.castling && parsed.castling.q === false)
				},
				enPassant: typeof parsed.enPassant === 'string' ? parsed.enPassant : null,
				halfmove: Number.isInteger(parsed.halfmove) ? parsed.halfmove : 0,
				fullmove: Number.isInteger(parsed.fullmove) && parsed.fullmove > 0 ? parsed.fullmove : 1
			};
		} catch (error) {
			return defaults;
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
		localStorage.setItem(gameKey, JSON.stringify(game));
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
		const turnColor = game.turn;

		if (!selectedSquare) {
			if (!piece) return;
			if (pieceColor(piece) !== turnColor) {
				updateTurnStatus('It is ' + colorName(turnColor) + '\'s turn.');
				return;
			}
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

		if (piece && pieceColor(piece) === pieceColor(movingPiece)) {
			if (pieceColor(piece) !== turnColor) {
				updateTurnStatus('It is ' + colorName(turnColor) + '\'s turn.');
				return;
			}
			selectedSquare = square;
			renderBoard();
			return;
		}

		if (!isLegalMove(selectedSquare, square, movingPiece, turnColor)) {
			updateTurnStatus('Illegal move for ' + movingPiece + '.');
			return;
		}

		const applied = applyMove(selectedSquare, square, movingPiece);
		if (!applied) {
			updateTurnStatus('Move could not be applied.');
			selectedSquare = null;
			renderBoard();
			return;
		}

		moves.push(applied.moveRecord);
		selectedSquare = null;
		persist();
		renderBoard();
		renderMoveList();
		sendMoveToEndpoint(applied.moveRecord);

		const enemy = game.turn;
		const enemyInCheck = isKingInCheck(enemy, board);
		const enemyHasMoves = hasAnyLegalMoves(enemy);
		if (!enemyHasMoves && enemyInCheck) {
			updateTurnStatus('Checkmate. ' + colorName(oppositeColor(enemy)) + ' wins.');
			return;
		}
		if (!enemyHasMoves && !enemyInCheck) {
			updateTurnStatus('Stalemate.');
			return;
		}
		if (enemyInCheck) {
			updateTurnStatus(colorName(enemy) + ' is in check.');
			return;
		}

		updateTurnStatus();
	}

	function renderMoveList() {
		if (!moveListEl) return;
		if (moves.length === 0) {
			moveListEl.textContent = 'No moves yet.';
			return;
		}

		const lines = moves.map((move, index) => {
			const action = move.captured ? 'x' : '-';
			const flags = [];
			if (move.castle === 'king') flags.push('O-O');
			if (move.castle === 'queen') flags.push('O-O-O');
			if (move.enPassant) flags.push('e.p.');
			if (move.promotion) flags.push('=' + move.promotion);
			const suffix = flags.length ? ' (' + flags.join(', ') + ')' : '';
			return (index + 1) + '. ' + move.piece + ' ' + move.from + action + move.to + suffix;
		});
		moveListEl.textContent = lines.join('\n');
	}

	function colorName(color) {
		return color === 'w' ? 'White' : 'Black';
	}

	function pieceColor(piece) {
		if (!piece) return null;
		return piece === piece.toUpperCase() ? 'w' : 'b';
	}

	function oppositeColor(color) {
		return color === 'w' ? 'b' : 'w';
	}

	function fileToIndex(file) {
		return files.indexOf(file);
	}

	function squareToCoords(square) {
		return {
			file: square[0],
			rank: parseInt(square[1], 10),
			f: fileToIndex(square[0]),
			r: parseInt(square[1], 10)
		};
	}

	function coordsToSquare(fileIndex, rank) {
		if (fileIndex < 0 || fileIndex > 7 || rank < 1 || rank > 8) return null;
		return files[fileIndex] + String(rank);
	}

	function findKingSquare(color, boardState) {
		const king = color === 'w' ? 'K' : 'k';
		for (let i = 0; i < files.length; i += 1) {
			for (let r = 1; r <= 8; r += 1) {
				const square = files[i] + r;
				if (boardState[square] === king) return square;
			}
		}
		return null;
	}

	function pathClear(from, to, boardState) {
		const a = squareToCoords(from);
		const b = squareToCoords(to);
		const fileStep = Math.sign(b.f - a.f);
		const rankStep = Math.sign(b.r - a.r);
		let f = a.f + fileStep;
		let r = a.r + rankStep;
		while (f !== b.f || r !== b.r) {
			const sq = coordsToSquare(f, r);
			if (sq && boardState[sq]) return false;
			f += fileStep;
			r += rankStep;
		}
		return true;
	}

	function isSquareAttacked(square, byColor, boardState) {
		const target = squareToCoords(square);
		const pawnDir = byColor === 'w' ? 1 : -1;
		const pawnRank = target.r - pawnDir;
		const pawnLeft = coordsToSquare(target.f - 1, pawnRank);
		const pawnRight = coordsToSquare(target.f + 1, pawnRank);
		const pawnPiece = byColor === 'w' ? 'P' : 'p';
		if ((pawnLeft && boardState[pawnLeft] === pawnPiece) || (pawnRight && boardState[pawnRight] === pawnPiece)) return true;

		const knightPiece = byColor === 'w' ? 'N' : 'n';
		const knightJumps = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
		for (let i = 0; i < knightJumps.length; i += 1) {
			const sq = coordsToSquare(target.f + knightJumps[i][0], target.r + knightJumps[i][1]);
			if (sq && boardState[sq] === knightPiece) return true;
		}

		const kingPiece = byColor === 'w' ? 'K' : 'k';
		for (let df = -1; df <= 1; df += 1) {
			for (let dr = -1; dr <= 1; dr += 1) {
				if (df === 0 && dr === 0) continue;
				const sq = coordsToSquare(target.f + df, target.r + dr);
				if (sq && boardState[sq] === kingPiece) return true;
			}
		}

		const bishopPiece = byColor === 'w' ? 'B' : 'b';
		const rookPiece = byColor === 'w' ? 'R' : 'r';
		const queenPiece = byColor === 'w' ? 'Q' : 'q';
		const rays = [
			[1, 0], [-1, 0], [0, 1], [0, -1],
			[1, 1], [1, -1], [-1, 1], [-1, -1]
		];

		for (let i = 0; i < rays.length; i += 1) {
			const df = rays[i][0];
			const dr = rays[i][1];
			let f = target.f + df;
			let r = target.r + dr;
			while (f >= 0 && f <= 7 && r >= 1 && r <= 8) {
				const sq = coordsToSquare(f, r);
				const piece = sq ? boardState[sq] : null;
				if (piece) {
					if (pieceColor(piece) === byColor) {
						const lower = piece.toLowerCase();
						if ((df === 0 || dr === 0) && (piece === rookPiece || piece === queenPiece || lower === 'r' || lower === 'q')) return true;
						if ((df !== 0 && dr !== 0) && (piece === bishopPiece || piece === queenPiece || lower === 'b' || lower === 'q')) return true;
					}
					break;
				}
				f += df;
				r += dr;
			}
		}

		return false;
	}

	function isKingInCheck(color, boardState) {
		const kingSquare = findKingSquare(color, boardState);
		if (!kingSquare) return false;
		return isSquareAttacked(kingSquare, oppositeColor(color), boardState);
	}

	function getPseudoMoveMeta(from, to, piece, color, boardState, gameState) {
		const fromC = squareToCoords(from);
		const toC = squareToCoords(to);
		if (!fromC || !toC) return null;
		if (from === to) return null;

		const targetPiece = boardState[to] || null;
		if (targetPiece && pieceColor(targetPiece) === color) return null;

		const deltaFile = toC.f - fromC.f;
		const deltaRank = toC.r - fromC.r;
		const absFile = Math.abs(deltaFile);
		const absRank = Math.abs(deltaRank);
		const lower = piece.toLowerCase();
		const meta = {
			capture: !!targetPiece,
			targetPiece: targetPiece,
			enPassant: false,
			castle: null,
			promotion: null,
			doubleStep: false
		};

		if (lower === 'p') {
			const dir = color === 'w' ? 1 : -1;
			const startRank = color === 'w' ? 2 : 7;
			const promoRank = color === 'w' ? 8 : 1;

			if (deltaFile === 0 && deltaRank === dir && !targetPiece) {
				if (toC.r === promoRank) meta.promotion = color === 'w' ? 'Q' : 'q';
				return meta;
			}

			if (deltaFile === 0 && deltaRank === 2 * dir && fromC.r === startRank && !targetPiece) {
				const stepSquare = coordsToSquare(fromC.f, fromC.r + dir);
				if (stepSquare && !boardState[stepSquare]) {
					meta.doubleStep = true;
					return meta;
				}
			}

			if (absFile === 1 && deltaRank === dir) {
				if (targetPiece && pieceColor(targetPiece) !== color) {
					if (toC.r === promoRank) meta.promotion = color === 'w' ? 'Q' : 'q';
					return meta;
				}

				if (!targetPiece && gameState.enPassant === to) {
					const capturedSq = coordsToSquare(toC.f, fromC.r);
					const capturedPawn = capturedSq ? boardState[capturedSq] : null;
					if (capturedPawn && capturedPawn.toLowerCase() === 'p' && pieceColor(capturedPawn) !== color) {
						meta.enPassant = true;
						meta.capture = true;
						meta.targetPiece = capturedPawn;
						meta.enPassantCaptureSquare = capturedSq;
						if (toC.r === promoRank) meta.promotion = color === 'w' ? 'Q' : 'q';
						return meta;
					}
				}
			}

			return null;
		}

		if (lower === 'n') {
			if ((absFile === 1 && absRank === 2) || (absFile === 2 && absRank === 1)) return meta;
			return null;
		}

		if (lower === 'b') {
			if (absFile === absRank && pathClear(from, to, boardState)) return meta;
			return null;
		}

		if (lower === 'r') {
			if ((absFile === 0 || absRank === 0) && pathClear(from, to, boardState)) return meta;
			return null;
		}

		if (lower === 'q') {
			if ((absFile === absRank || absFile === 0 || absRank === 0) && pathClear(from, to, boardState)) return meta;
			return null;
		}

		if (lower === 'k') {
			if (absFile <= 1 && absRank <= 1) return meta;

			const homeRank = color === 'w' ? 1 : 8;
			if (from !== ('e' + homeRank)) return null;
			if (to === ('g' + homeRank)) {
				const canCastle = color === 'w' ? gameState.castling.K : gameState.castling.k;
				if (!canCastle) return null;
				if (boardState['f' + homeRank] || boardState['g' + homeRank]) return null;
				const rook = boardState['h' + homeRank];
				if (!rook || rook.toLowerCase() !== 'r' || pieceColor(rook) !== color) return null;
				if (isSquareAttacked('e' + homeRank, oppositeColor(color), boardState)) return null;
				if (isSquareAttacked('f' + homeRank, oppositeColor(color), boardState)) return null;
				if (isSquareAttacked('g' + homeRank, oppositeColor(color), boardState)) return null;
				meta.castle = 'king';
				return meta;
			}
			if (to === ('c' + homeRank)) {
				const canCastle = color === 'w' ? gameState.castling.Q : gameState.castling.q;
				if (!canCastle) return null;
				if (boardState['b' + homeRank] || boardState['c' + homeRank] || boardState['d' + homeRank]) return null;
				const rook = boardState['a' + homeRank];
				if (!rook || rook.toLowerCase() !== 'r' || pieceColor(rook) !== color) return null;
				if (isSquareAttacked('e' + homeRank, oppositeColor(color), boardState)) return null;
				if (isSquareAttacked('d' + homeRank, oppositeColor(color), boardState)) return null;
				if (isSquareAttacked('c' + homeRank, oppositeColor(color), boardState)) return null;
				meta.castle = 'queen';
				return meta;
			}

			return null;
		}

		return null;
	}

	function simulateMove(from, to, piece, color, meta, boardState, gameState) {
		const nextBoard = Object.assign({}, boardState);
		const nextGame = {
			turn: gameState.turn,
			castling: Object.assign({}, gameState.castling),
			enPassant: gameState.enPassant,
			halfmove: gameState.halfmove,
			fullmove: gameState.fullmove
		};

		delete nextBoard[from];

		if (meta.enPassant && meta.enPassantCaptureSquare) {
			delete nextBoard[meta.enPassantCaptureSquare];
		}

		nextBoard[to] = meta.promotion || piece;

		if (meta.castle === 'king') {
			const homeRank = color === 'w' ? 1 : 8;
			nextBoard['f' + homeRank] = nextBoard['h' + homeRank];
			delete nextBoard['h' + homeRank];
		}
		if (meta.castle === 'queen') {
			const homeRank = color === 'w' ? 1 : 8;
			nextBoard['d' + homeRank] = nextBoard['a' + homeRank];
			delete nextBoard['a' + homeRank];
		}

		nextGame.enPassant = null;
		if (piece.toLowerCase() === 'p' && meta.doubleStep) {
			const c = squareToCoords(from);
			const dir = color === 'w' ? 1 : -1;
			nextGame.enPassant = coordsToSquare(c.f, c.r + dir);
		}

		if (piece === 'K') {
			nextGame.castling.K = false;
			nextGame.castling.Q = false;
		}
		if (piece === 'k') {
			nextGame.castling.k = false;
			nextGame.castling.q = false;
		}
		if (piece === 'R' && from === 'h1') nextGame.castling.K = false;
		if (piece === 'R' && from === 'a1') nextGame.castling.Q = false;
		if (piece === 'r' && from === 'h8') nextGame.castling.k = false;
		if (piece === 'r' && from === 'a8') nextGame.castling.q = false;

		if (meta.capture && !meta.enPassant) {
			if (to === 'h1') nextGame.castling.K = false;
			if (to === 'a1') nextGame.castling.Q = false;
			if (to === 'h8') nextGame.castling.k = false;
			if (to === 'a8') nextGame.castling.q = false;
		}

		nextGame.halfmove = (piece.toLowerCase() === 'p' || meta.capture) ? 0 : nextGame.halfmove + 1;
		if (color === 'b') nextGame.fullmove += 1;
		nextGame.turn = oppositeColor(color);

		return { nextBoard: nextBoard, nextGame: nextGame };
	}

	function isLegalMove(from, to, piece, color) {
		if (pieceColor(piece) !== color) return false;
		const meta = getPseudoMoveMeta(from, to, piece, color, board, game);
		if (!meta) return false;
		const simulated = simulateMove(from, to, piece, color, meta, board, game);
		return !isKingInCheck(color, simulated.nextBoard);
	}

	function applyMove(from, to, piece) {
		const color = pieceColor(piece);
		const meta = getPseudoMoveMeta(from, to, piece, color, board, game);
		if (!meta) return null;
		const simulated = simulateMove(from, to, piece, color, meta, board, game);
		if (isKingInCheck(color, simulated.nextBoard)) return null;

		board = simulated.nextBoard;
		game = simulated.nextGame;

		return {
			moveRecord: {
				from: from,
				to: to,
				piece: piece,
				captured: meta.capture ? meta.targetPiece : null,
				promotion: meta.promotion || null,
				enPassant: !!meta.enPassant,
				castle: meta.castle || null,
				timestamp: new Date().toISOString(),
				turnAfter: game.turn
			}
		};
	}

	function hasAnyLegalMoves(color) {
		for (let fi = 0; fi < files.length; fi += 1) {
			for (let rank = 1; rank <= 8; rank += 1) {
				const from = files[fi] + rank;
				const piece = board[from];
				if (!piece || pieceColor(piece) !== color) continue;
				for (let tf = 0; tf < files.length; tf += 1) {
					for (let tr = 1; tr <= 8; tr += 1) {
						const to = files[tf] + tr;
						if (isLegalMove(from, to, piece, color)) return true;
					}
				}
			}
		}
		return false;
	}

	function updateTurnStatus(message) {
		if (message) {
			updateStatus(message);
			return;
		}
		const turnText = colorName(game.turn) + ' to move.';
		if (!endpoint) {
			updateStatus(turnText + ' Local-only logging (no endpoint set).');
			return;
		}
		updateStatus(turnText + ' Live logging enabled.');
	}

	function buildLogPayload(lastMove) {
		return {
			page: window.location.pathname,
			lastMove: lastMove || null,
			moves: moves,
			board: board,
			game: game,
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