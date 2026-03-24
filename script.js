const boardEl = document.getElementById("board");

// Simple model: 8x8 array (row-major). Each cell is null or a code like "wP" or "bK"
const initial = [
    ["bR","bN","bB","bQ","bK","bB","bN","bR"],
    ["bP","bP","bP","bP","bP","bP","bP","bP"],
    [ null,null,null,null,null,null,null,null ],
    [ null,null,null,null,null,null,null,null ],
    [ null,null,null,null,null,null,null,null ],
    [ null,null,null,null,null,null,null,null ],
    ["wP","wP","wP","wP","wP","wP","wP","wP"],
    ["wR","wN","wB","wQ","wK","wB","wN","wR"]
];

const glyphs = {
    "wK":"♔","wQ":"♕","wR":"♖","wB":"♗","wN":"♘","wP":"♙",
    "bK":"♚","bQ":"♛","bR":"♜","bB":"♝","bN":"♞","bP":"♟"
};

let board = flatten(initial); // single-dim length 64
let squares = []; // DOM refs
let selectedIndex = null;
let lastMove = null;

function flatten(mat) {
    const out = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) out.push(mat[r][c]);
    }
    return out;
}

function createBoard() {
    boardEl.innerHTML = "";
    squares = [];
    for (let i = 0; i < 64; i++) {
        const square = document.createElement("div");
        square.classList.add("square");
        const row = Math.floor(i / 8);
        const col = i % 8;
        if ((row + col) % 2 === 0) square.classList.add("white");
        else square.classList.add("black");
        square.dataset.index = i.toString();
        boardEl.appendChild(square);
        squares.push(square);
    }
    render();
}

function render() {
    for (let i = 0; i < 64; i++) {
        const piece = board[i];
        const el = squares[i];
        if (piece) {
            const glyph = glyphs[piece] || '';
            const colorClass = piece[0] === 'w' ? 'white' : 'black';
            const isLift = selectedIndex === i ? 'lift' : '';
            el.innerHTML = `<span class="piece ${colorClass} ${isLift}">${glyph}</span>`;
        } else {
            el.innerHTML = '';
        }
        el.classList.toggle('selected', selectedIndex === i);
        el.classList.toggle('last-move', lastMove && (lastMove.from === i || lastMove.to === i));
    }
}

function isSameColor(a, b) {
    if (!a || !b) return false;
    return a[0] === b[0];
}

boardEl.addEventListener("click", (ev) => {
    const sq = ev.target.closest(".square");
    if (!sq) return;
    const idx = parseInt(sq.dataset.index, 10);
    const piece = board[idx];

    // If nothing selected and clicked a piece -> select it
    if (selectedIndex === null) {
        if (piece) {
            selectedIndex = idx;
            render();
        }
        return;
    }

    // If clicked same square -> deselect
    if (selectedIndex === idx) {
        selectedIndex = null;
        render();
        return;
    }

    // We have a selection and clicked elsewhere
    const selectedPiece = board[selectedIndex];

    // If clicked another piece of same color -> change selection
    if (piece && isSameColor(piece, selectedPiece)) {
        selectedIndex = idx;
        render();
        return;
    }

    // Simple move: move the selected piece to the clicked square (allow capture except same color)
    board[idx] = selectedPiece;
    board[selectedIndex] = null;
    lastMove = { from: selectedIndex, to: idx };
    selectedIndex = null;
    render();
});

// Initialize
createBoard();
render();