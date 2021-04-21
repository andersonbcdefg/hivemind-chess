// TODO: Allow player to choose white or black.
// TODO: Allow game to start from any position (FEN string)

var board = null
var game = new Chess()
MicroModal.init()

// Global data to track what to promote to
var human_color = "w"
var computer_color = "b"
var promotion = "q";
var _promote;
var do_not_snap;

const countPieces = () => {
  let arr = game.board()
  let flat = [];
  for (row of arr) {
    for (square of row) {
      flat.push(square)
    }
  }
  let n = flat.map(x => {if (!x) return 0; return 1}).reduce((a, b) => a + b)
  return n;
}

const undo = () => {
  if (game.turn() == human_color) game.undo()
  game.undo()
  update()
}

const switchSides = () => {
  let temp = human_color;
  human_color = computer_color;
  computer_color = temp;
  board.flip();
  setTimeout(() => makeComputerMove(), 500)
}

const sendToast = (message, color) => {
  Toastify({
    text: message,
    duration: 5000,
    gravity: "top",
    position: "right", //
    backgroundColor: color,
  }).showToast();
}

const checkGameOver = () => {
  possibleMoves = game.moves()
  turn = game.turn()
  if (game.game_over()) {
    if (game.in_checkmate() && turn == human_color) {
      sendToast("Checkmate! You lose.", "FireBrick")
    } else if (game.in_checkmate()) {
      sendToast("Checkmate! You win.", "Green")
    } else {
      sendToast("Draw.", "SlateGray")
    }
    return true;
  }
  return false;
}

const update = () => {
  board.position(game.fen())
  document.querySelector("#pgn").textContent = game.pgn()
  document.querySelector("#fen").textContent = game.fen()
  document.querySelector("#lichess-link").href = `https://lichess.org/analysis/${encodeURI(game.fen())}`
  checkGameOver();
}

const checkPromotion = (source, target) => {
  let {type, color} = game.get(source);
  if (type !== "p") return false;
  if (color === "w" && target[1] == "8") return true;
  if (color === "b" && target[1] == "1") return true;
  return false;
}

const handlePromotion = async (source, target) => {
  MicroModal.show("promotion-modal");
  var promise = new Promise((resolve) => { _promote = resolve });
  await promise.then(x => { promotion = x });
  game.move({
    from: source,
    to: target,
    promotion: promotion
  });
  update();
  do_not_snap = false;
  window.setTimeout(() => makeComputerMove(), 500);
}

function onDragStart (source, piece, position, orientation) {
  // do not pick up pieces if the game is over
  if (game.game_over()) return false

  // only pick up pieces for the player's color
  if (piece.search(/^b/) !== -1 && human_color === "w") return false
  if (piece.search(/^w/) !== -1 && human_color === "b") return false
}

async function makeComputerMove(random_move=false) {
  // Check if game is over.
  if (game.game_over()) return;

  // Pick a random move if random_move is true.
  if (random_move) {
    var possibleMoves = game.moves()
    game.move(chance.pickone(possibleMoves));
    update();
    return;
  
  // Otherwise, use Lichess database to select a move.
  } else {
    // Encode FEN
    var fen = encodeURI(game.fen())

    // If 7 or fewer pieces on board, probe TableBase and play best move.
    let move;
    if (countPieces() < 8) {
      let res = await fetch(`https://tablebase.lichess.ovh/standard?fen=${fen}`)
      let parsed = await res.json()
      move = parsed["moves"][0]["san"]
    } else {
    // Otherwise, choose move weighted by popularity among human players on LiChess.
      let res = await fetch(`https://explorer.lichess.ovh/lichess?variant=standard&ratings[]=2000&ratings[]=1800&ratings[]=2200&ratings[]=2500&fen=${fen}&speeds[]=rapid&speeds[]=blitz&speeds[]=classical&speeds[]=bullet`)
      let parsed = await res.json()
      let move_names = parsed["moves"].map(d => d["san"])
      let move_weights = parsed["moves"].map(d => d.white + d.black + d.draws)
      if (move_names.length === 0) {
        sendToast("No more games from this position. Playing random move.", "orange")
        move = chance.pickone(game.moves());
      } else {
        move = chance.weighted(move_names, move_weights)
      }
    }
    game.move(move); 
    update();
  }
}

async function onDrop (source, target) {
  promotion = 'q'

  // Check if move is legal
  var move = game.move({
    from: source,
    to: target,
    promotion: promotion
  })
  if (move === null) {
    return 'snapback';
  }

  // Check for promotion
  game.undo()
  if (checkPromotion(source, target)) {
    do_not_snap = true;
    setTimeout(() => handlePromotion(source, target), 25);
    return;
  }

  // Execute move
  game.move({
    from: source,
    to: target,
    promotion: promotion
  })

  // Make move for other side
  window.setTimeout(() => makeComputerMove(), 500)
}

function onSnapEnd () {
  if (do_not_snap) return;
  update();
}

var config = {
  draggable: true,
  position: 'start',
  onDragStart: onDragStart,
  onDrop: onDrop,
  onSnapEnd: onSnapEnd
}
board = Chessboard('myBoard', config)

document.querySelector("#queen").addEventListener('click', () => _promote("q"))
document.querySelector("#rook").addEventListener('click', () => _promote("r"))
document.querySelector("#bishop").addEventListener('click', () => _promote("b"))
document.querySelector("#knight").addEventListener('click', () => _promote("n"))
document.querySelector("#switch").addEventListener('click', () => switchSides())
document.querySelector("#undo").addEventListener('click', () => undo())

update();







