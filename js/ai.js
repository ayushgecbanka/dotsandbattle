/* ================= COMPUTER AI ================= */

function getAvailableMoves(){

    if(!game || !game.lines) return [];

    const n = Number(game.size);

    const moves = [];

    /* Horizontal: n rows × (n-1) columns = n * (n-1) lines. */

    for(let i = 0; i < n; i++){

        for(let j = 0; j < n - 1; j++){

            const hKey = "h_" + i + "_" + j;

            if(!game.lines[hKey]){

                moves.push({ key: hKey, type: "h", i: i, j: j });

            }

        }

    }

    /* Vertical: (n-1) rows × n columns = n * (n-1) lines. */

    for(let i = 0; i < n - 1; i++){

        for(let j = 0; j < n; j++){

            const vKey = "v_" + i + "_" + j;

            if(!game.lines[vKey]){

                moves.push({ key: vKey, type: "v", i: i, j: j });

            }

        }

    }

    return moves;

}


function isBoxComplete(boxKey){

    if(!game || !game.lines) return false;

    const parts = boxKey.split("_");

    const r = Number(parts[0]);

    const c = Number(parts[1]);

    const top = "h_"+r+"_"+c;

    const bottom = "h_"+(r+1)+"_"+c;

    const left = "v_"+r+"_"+c;

    const right = "v_"+r+"_"+(c+1);

    return !!(game.lines[top] && game.lines[bottom] && game.lines[left] && game.lines[right]);

}


function countCompletedBoxesForMove(move){

    if(!game) return 0;

    /* A move COMPLETES a box if exactly 3 of the 4 sides are already drawn
       (so drawing this move makes it 4). We must simulate adding the move
       to game.lines before checking. */

    const saved = game.lines[move.key];

    game.lines[move.key] = (game.lines[move.key] || "simulated");

    const n = Number(game.size);

    let count = 0;

    if(move.type === "h"){

        const box1 = move.i + "_" + move.j;

        if(isBoxComplete(box1)){

            count++;

        }

        if(move.i > 0){

            const box2 = (move.i - 1) + "_" + move.j;

            if(isBoxComplete(box2)){

                count++;

            }

        }

    }

    else{

        const box1 = move.i + "_" + move.j;

        if(isBoxComplete(box1)){

            count++;

        }

        if(move.j > 0){

            const box2 = move.i + "_" + (move.j - 1);

            if(isBoxComplete(box2)){

                count++;

            }

        }

    }

    /* Restore game.lines */

    if(saved === undefined){

        delete game.lines[move.key];

    }

    else{

        game.lines[move.key] = saved;

    }

    return count;

}


function wouldGiveBoxToOpponent(move){

    if(!game) return false;

    const n = Number(game.size);

    let boxes = [];

    if(move.type === "h"){

        const box1 = move.i + "_" + move.j;

        boxes.push(box1);

        if(move.i > 0){

            boxes.push((move.i - 1) + "_" + move.j);

        }

    }

    else{

        const box1 = move.i + "_" + move.j;

        boxes.push(box1);

        if(move.j > 0){

            boxes.push(move.i + "_" + (move.j - 1));

        }

    }

    for(const b of boxes){

        if(isBoxComplete(b)) continue;

        const parts = b.split("_");

        const r = Number(parts[0]);

        const c = Number(parts[1]);

        const needed = ["top", "right", "bottom", "left"];

        let missing = 0;

        for(const s of needed){

            let key;

            if(s === "top") key = "h_"+r+"_"+c;

            else if(s === "bottom") key = "h_"+(r+1)+"_"+c;

            else if(s === "left") key = "v_"+r+"_"+c;

            else key = "v_"+r+"_"+(c+1);

            if(!game.lines[key]) missing++;

        }

        if(missing === 1){

            return true;

        }

    }

    return false;

}


function evaluateMove(move){

    const boxesCompleted = countCompletedBoxesForMove(move);

    const givesToOpponent = wouldGiveBoxToOpponent(move);

    return boxesCompleted * 10 - (givesToOpponent ? 5 : 0);

}


/* ================= AI HELPERS ================= */

function getBoxSides(boxKey){

    const parts = boxKey.split("_");

    const r = Number(parts[0]);

    const c = Number(parts[1]);

    return {

        top:    "h_"+r+"_"+c,

        bottom: "h_"+(r+1)+"_"+c,

        left:   "v_"+r+"_"+c,

        right:  "v_"+r+"_"+(c+1)

    };

}


function countMissingSides(boxKey){

    if(!game || !game.lines) return 0;

    if(game.boxes && game.boxes[boxKey]) return 0;

    const sides = getBoxSides(boxKey);

    let missing = 0;

    if(!game.lines[sides.top])    missing++;

    if(!game.lines[sides.bottom]) missing++;

    if(!game.lines[sides.left])   missing++;

    if(!game.lines[sides.right])  missing++;

    return missing;

}


function getAdjacentBoxes(move){

    const boxes = [];

    if(move.type === "h"){

        boxes.push(move.i + "_" + move.j);

        if(move.i > 0) boxes.push((move.i - 1) + "_" + move.j);

    }

    else{

        boxes.push(move.i + "_" + move.j);

        if(move.j > 0) boxes.push(move.i + "_" + (move.j - 1));

    }

    return boxes;

}


function moveWouldGiveAwayBoxes(move){

    const adj = getAdjacentBoxes(move);

    for(const b of adj){

        if(countMissingSides(b) === 1) return true;

    }

    return false;

}


function countFreeBoxesAfterMove(move){

    const adj = getAdjacentBoxes(move);

    let count = 0;

    for(const b of adj){

        if(countMissingSides(b) === 1) count++;

    }

    return count;

}


function getAllBoxKeys(){

    if(!game) return [];

    const n = Number(game.size);

    const keys = [];

    for(let r=0;r<n-1;r++){

        for(let c=0;c<n-1;c++){

            keys.push(r+"_"+c);

        }

    }

    return keys;

}


/* ================= HARD AI: ALPHA-BETA SEARCH ================= */

function simulateMove(state, move, player){

    const next = {

        size: state.size,

        lines: Object.assign({}, state.lines),

        boxes: Object.assign({}, state.boxes),

        scores: {

            p1: state.scores.p1,

            p2: state.scores.p2

        }

    };

    next.lines[move.key] = player;

    let gained = 0;

    const adj = getAdjacentBoxesForState(state, move);

    for(const b of adj){

        if(next.boxes[b]) continue;

        const sides = getBoxSides(b);

        if(next.lines[sides.top] && next.lines[sides.bottom] &&
           next.lines[sides.left] && next.lines[sides.right]){

            next.boxes[b] = player;

            next.scores[player]++;

            gained++;

        }

    }

    next.lastGained = gained;

    return next;

}


function getAdjacentBoxesForState(state, move){

    const n = Number(state.size);

    const boxes = [];

    if(move.type === "h"){

        boxes.push(move.i + "_" + move.j);

        if(move.i > 0) boxes.push((move.i - 1) + "_" + move.j);

    }

    else{

        boxes.push(move.i + "_" + move.j);

        if(move.j > 0) boxes.push(move.i + "_" + (move.j - 1));

    }

    const valid = [];

    for(const b of boxes){

        const parts = b.split("_");

        const r = Number(parts[0]);

        const c = Number(parts[1]);

        if(r >= 0 && r < n-1 && c >= 0 && c < n-1) valid.push(b);

    }

    return valid;

}


function getAvailableMovesForState(state){

    const n = Number(state.size);

    const moves = [];

    for(let i = 0; i < n - 1; i++){

        for(let j = 0; j < n - 1; j++){

            const hKey = "h_" + i + "_" + j;

            if(!state.lines[hKey]) moves.push({ key: hKey, type: "h", i: i, j: j });

            const vKey = "v_" + i + "_" + j;

            if(!state.lines[vKey]) moves.push({ key: vKey, type: "v", i: i, j: j });

        }

    }

    return moves;

}


function countMissingSidesForState(state, boxKey){

    if(state.boxes[boxKey]) return 0;

    const sides = getBoxSides(boxKey);

    let missing = 0;

    if(!state.lines[sides.top])    missing++;

    if(!state.lines[sides.bottom]) missing++;

    if(!state.lines[sides.left])   missing++;

    if(!state.lines[sides.right])  missing++;

    return missing;

}


function moveWouldGiveAwayForState(state, move){

    const adj = getAdjacentBoxesForState(state, move);

    for(const b of adj){

        if(countMissingSidesForState(state, b) === 1) return true;

    }

    return false;

}


function evaluateState(state, aiPlayer, depth){

    const opp = aiPlayer === "p2" ? "p1" : "p2";

    let score = (state.scores[aiPlayer] - state.scores[opp]) * 100;

    const moves = getAvailableMovesForState(state);

    for(const m of moves){

        if(moveWouldGiveAwayForState(state, m)) score -= 15;

    }

    return score - depth;

}


function alphaBeta(state, aiPlayer, depth, alpha, beta, maximizing, deadline){

    if(deadline && Date.now() > deadline) return evaluateState(state, aiPlayer, depth);

    const moves = getAvailableMovesForState(state);

    if(moves.length === 0 || depth <= 0){

        return evaluateState(state, aiPlayer, depth);

    }

    const n = Number(state.size);

    const totalLines = 2 * n * (n - 1);

    if(Object.keys(state.lines).length >= totalLines){

        return evaluateState(state, aiPlayer, depth);

    }

    const taking = moves.filter(m => {

        const sim = simulateMove(state, m, maximizing ? aiPlayer : (aiPlayer === "p2" ? "p1" : "p2"));

        return sim.lastGained > 0;

    });

    if(taking.length > 0){

        let best = -Infinity;

        for(const m of taking){

            const next = simulateMove(state, m, maximizing ? aiPlayer : (aiPlayer === "p2" ? "p1" : "p2"));

            const v = alphaBeta(next, aiPlayer, depth - 1, alpha, beta, maximizing, deadline);

            if(v > best) best = v;

            if(best > alpha) alpha = best;

            if(beta <= alpha) break;

        }

        return best;

    }

    const nonGiving = moves.filter(m => !moveWouldGiveAwayForState(state, m));

    const candidates = nonGiving.length > 0 ? nonGiving : moves;

    if(maximizing){

        let best = -Infinity;

        for(const m of candidates){

            const next = simulateMove(state, m, aiPlayer);

            const v = alphaBeta(next, aiPlayer, depth - 1, alpha, beta, false, deadline);

            if(v > best) best = v;

            if(best > alpha) alpha = best;

            if(beta <= alpha) break;

        }

        return best;

    }

    else{

        let best = Infinity;

        const opp = aiPlayer === "p2" ? "p1" : "p2";

        for(const m of candidates){

            const next = simulateMove(state, m, opp);

            const v = alphaBeta(next, aiPlayer, depth - 1, alpha, beta, true, deadline);

            if(v < best) best = v;

            if(best < beta) beta = best;

            if(beta <= alpha) break;

        }

        return best;

    }

}


function pickHardMove(moves, deadline){

    const n = Number(game.size);

    const totalLines = 2 * n * (n - 1);

    if(moves.length === 0) return null;

    const taking = moves.filter(m => countCompletedBoxesForMove(m) > 0);

    if(taking.length > 0){

        let bestMove = taking[0];

        let bestScore = -Infinity;

        for(const m of taking){

            const sim = simulateMove(game, m, "p2");

            const v = alphaBeta(sim, "p2", 3, -Infinity, Infinity, true, deadline);

            if(v > bestScore){

                bestScore = v;

                bestMove = m;

            }

        }

        return bestMove;

    }

    const nonGiving = moves.filter(m => !moveWouldGiveAwayBoxes(m));

    const candidates = nonGiving.length > 0 ? nonGiving : moves;

    let bestMove = candidates[0];

    let bestScore = -Infinity;

    for(const m of candidates){

        const sim = simulateMove(game, m, "p2");

        const v = alphaBeta(sim, "p2", 2, -Infinity, Infinity, true, deadline);

        if(v > bestScore){

            bestScore = v;

            bestMove = m;

        }

    }

    return bestMove;

}


/* ================= COMPUTER MOVE ================= */

function getComputerMove(){

    if(!game || game.finished) return null;

    const moves = getAvailableMoves();

    if(moves.length === 0) return null;

    /* HARD RULE FOR ALL DIFFICULTIES:
       If any move completes a box, the computer MUST take it.
       Completing a box grants another turn in Dots & Boxes, so a
       box-taking move is always strictly better than a non-taking move.
       This rule applies to Easy, Medium, and Hard. */

    const taking = moves.filter(m => countCompletedBoxesForMove(m) > 0);

    if(taking.length > 0){

        taking.sort((a, b) => countCompletedBoxesForMove(b) - countCompletedBoxesForMove(a));

        const best = taking[0];

        console.log("AI BOX-TAKING", { difficulty: selectedDifficulty, takingCount: taking.length, bestMove: best.key, boxesCompleted: countCompletedBoxesForMove(best) });

        console.log("AI MOVE", { difficulty: selectedDifficulty, move: best.key, boxesCompleted: countCompletedBoxesForMove(best), turn: game.turn, availableMoves: moves.length });

        return best;

    }

    if(selectedDifficulty === "easy"){

        /* Easy: random legal move when no box is available. */

        const safe = moves.filter(m => !moveWouldGiveAwayBoxes(m));

        const pool = (safe.length > 0 && Math.random() < 0.4) ? safe : moves;

        const pick = pool[Math.floor(Math.random() * pool.length)];

        console.log("AI MOVE", { difficulty: selectedDifficulty, move: pick.key, boxesCompleted: 0, turn: game.turn, availableMoves: moves.length });

        return pick;

    }

    else if(selectedDifficulty === "medium"){

        /* Medium: avoid giving easy boxes; among safe moves, prefer ones
           that minimize the opponent's follow-up boxes. */

        const nonGiving = moves.filter(m => !moveWouldGiveAwayBoxes(m));

        let pick;

        if(nonGiving.length > 0){

            nonGiving.sort((a, b) => {

                const fa = countFreeBoxesAfterMove(a);

                const fb = countFreeBoxesAfterMove(b);

                if(fa !== fb) return fb - fa;

                return evaluateMove(b) - evaluateMove(a);

            });

            pick = nonGiving[0];

        }

        else{

            moves.sort((a, b) => evaluateMove(b) - evaluateMove(a));

            pick = moves[0];

        }

        console.log("AI MOVE", { difficulty: selectedDifficulty, move: pick.key, boxesCompleted: 0, turn: game.turn, availableMoves: moves.length });

        return pick;

    }

    else{

        /* Hard: limited-depth alpha-beta search with a time budget. */

        const n = Number(game.size);

        let budgetMs = n <= 3 ? 400 : (n === 4 ? 350 : (n === 5 ? 250 : 200));

        const deadline = Date.now() + budgetMs;

        const pick = pickHardMove(moves, deadline);

        if(pick){

            console.log("AI MOVE", { difficulty: selectedDifficulty, move: pick.key, boxesCompleted: countCompletedBoxesForMove(pick), turn: game.turn, availableMoves: moves.length });

        }

        return pick;

    }

}


function applyComputerMove(){

    if(!game || game.finished) return;

    if(computerThinking) return;

    computerThinking = true;

    document.getElementById("turnDisplay").textContent = "🤖 Computer is thinking...";

    const delay = 500 + Math.random() * 500;

    /* AI TURN-CHAIN FIX:
       The previous design called applyComputerMove() recursively from
       inside makeLocalMove(), but computerThinking was still true at
       that point, so the guard blocked the next move and the computer
       silently lost its turn. The fix is to:
         1) Never call applyComputerMove() from makeLocalMove().
         2) After the current AI move resolves, check whether the
            computer still has the turn and the game is not finished.
         3) If so, schedule a fresh setTimeout for the next AI move
            with the standard thinking delay.
       This guarantees no overlapping timers and no duplicate moves. */

    const chainNext = () => {

        computerThinking = false;

        if(!game) return;

        renderGame();

        if(game.finished){

            handleGameEnd();

            return;

        }

        if(gameMode === "computer" && game.turn === "p2" && !game.finished){

            applyComputerMove();

        }

    };

    computerTimer = setTimeout(() => {

        computerTimer = null;

        if(!game || game.finished){

            chainNext();

            return;

        }

        const move = getComputerMove();

        if(move){

            const ok = makeLocalMove(move.key, "p2");

            if(!ok){

                chainNext();

                return;

            }

            if(game){

                const boxesCompleted = (move && game.boxes) ? Object.keys(game.boxes).filter(b => game.boxes[b] === "p2").length : 0;

                console.log("AI AFTER MOVE", { boxesCompleted, turn: game.turn, computerThinking, finished: game.finished });

            }

        }

        chainNext();

    }, delay);

}


