/* ================= GAME MODE ================= */

function setMode(mode){

    gameMode = mode;

    document.getElementById("modeScreen").style.display = "none";
    document.getElementById("computerSetup").style.display = "none";
    document.getElementById("offlineSetup").style.display = "none";
    document.getElementById("onlineSetup").style.display = "none";

    if(mode === "computer"){

        document.getElementById("computerSetup").style.display = "block";

        if(myProfile && myProfile.displayName){

            document.getElementById("computerName").value = myProfile.displayName;

        }

    }

    else if(mode === "offline"){

        document.getElementById("offlineSetup").style.display = "block";

    }

    else if(mode === "online"){

        document.getElementById("onlineSetup").style.display = "block";

    }

}


function goHome(){

    cancelResultCountdown();
    cleanupChatListener();
    cleanupRoomListeners();

    if(computerTimer){

        clearTimeout(computerTimer);

        computerTimer = null;

        computerThinking = false;

    }

    if(resultHomeTimer){

        clearTimeout(resultHomeTimer);

        resultHomeTimer = null;

    }

    if(disconnectTimer){

        clearTimeout(disconnectTimer);

        disconnectTimer = null;

    }

    gameMode = "";

    game = null;

    roomCode = "";

    myPlayer = "";

    resultRecorded = false;

    computerThinking = false;

    roomStatus = "";

    playerLeft = false;

    resultReason = "";

    document.getElementById("setupScreen").style.display = "block";

    document.getElementById("modeScreen").style.display = "block";

    document.getElementById("computerSetup").style.display = "none";

    document.getElementById("offlineSetup").style.display = "none";

    document.getElementById("onlineSetup").style.display = "none";

    document.getElementById("gameScreen").style.display = "none";

    const chatPanel = document.getElementById("chatPanel");
    if(chatPanel){
        chatPanel.style.display = "none";
    }

    document.getElementById("result").textContent = "";

    document.getElementById("turnDisplay").textContent = "Waiting...";

}



function goBack(){

    cancelResultCountdown();

    if(gameMode === "computer" || gameMode === "offline"){

        if(game && !game.finished){

            if(!window.confirm("⚠️ Leave Game?\n\nLeaving now will end this match.")){

                return;

            }

        }

        goHome();

    }

    else if(gameMode === "online"){

        if(game && !game.finished && !playerLeft){

            document.getElementById("leaveModal").classList.add("open");

        }

        else{

            goHome();

        }

    }

    else{

        goHome();

    }

}


document.getElementById("leaveCancelBtn").addEventListener("click", function(){

    document.getElementById("leaveModal").classList.remove("open");

});


document.getElementById("leaveConfirmBtn").addEventListener("click", async function(){

    document.getElementById("leaveModal").classList.remove("open");

    await handleLocalForfeit();

});



/* ================= DIFFICULTY ================= */

document.querySelectorAll(".diff-btn").forEach(btn => {

    btn.addEventListener("click", function(){

        document.querySelectorAll(".diff-btn").forEach(b => b.classList.remove("selected"));

        this.classList.add("selected");

        selectedDifficulty = this.dataset.diff;

    });

});


/* ================= MODE BUTTONS ================= */

document.getElementById("modeComputer").addEventListener("click", () => setMode("computer"));

document.getElementById("modeOffline").addEventListener("click", () => setMode("offline"));

document.getElementById("modeOnline").addEventListener("click", () => setMode("online"));

document.getElementById("backFromComputer").addEventListener("click", goBack);

document.getElementById("backFromOffline").addEventListener("click", goBack);

document.getElementById("backFromOnline").addEventListener("click", goBack);


/* ================= START COMPUTER ================= */

document.getElementById("startComputer").addEventListener("click", () => {

    try{
    console.log("[DEBUG] startComputer clicked");
    const name =
    document.getElementById("computerName").value.trim() ||
    (myProfile && myProfile.displayName) ||
    (currentUser && currentUser.displayName) ||
    "Player";

    gameMode = "computer";

    roomCode = "computer_" + Date.now();

    myPlayer = "p1";

    game = {

        size:selectedSize,

        gameId:roomCode,

        players:{
            p1:{
                uid: currentUser ? currentUser.uid : "local",
                name: name,
                username: myProfile ? myProfile.username : "",
                photoURL: myProfile ? myProfile.photoURL : "",
                avatarType: myProfile ? (myProfile.avatarType || "google") : "google",
                avatarId: myProfile ? (myProfile.avatarId || "") : ""
            },
            p2:{
                uid: "computer",
                name: "🤖 Computer",
                username: "",
                photoURL: "",
                avatarType: "google",
                avatarId: ""
            }
        },

        scores:{
            p1:0,
            p2:0
        },

        turn:"p1",

        lines:{},

        boxes:{},

        finished:false,

        vsComputer:true

    };

    console.log("[DEBUG] startComputer game before openGame", JSON.stringify({mode:gameMode, size:game.size, hasPlayers:!!game.players, hasScores:!!game.scores}));
    openGame();

    }
    catch(error){
        console.error("[startComputer FATAL]", error);
        const resultEl = document.getElementById("result");
        if(resultEl) resultEl.textContent = "⚠️ Start error: " + (error.message || error);
    }

});


/* ================= START OFFLINE ================= */

document.getElementById("startOffline").addEventListener("click", () => {

    const p1 =
    document.getElementById("offlineP1Name").value.trim() || "Player 1";

    const p2 =
    document.getElementById("offlineP2Name").value.trim() || "Player 2";

    gameMode = "offline";

    roomCode = "offline_" + Date.now();

    myPlayer = "p1";

    game = {

        size:selectedSize,

        gameId:roomCode,

        players:{
            p1:{
                uid: "offline_p1",
                name: p1,
                username: "",
                photoURL: "",
                avatarType: "google",
                avatarId: ""
            },
            p2:{
                uid: "offline_p2",
                name: p2,
                username: "",
                photoURL: "",
                avatarType: "google",
                avatarId: ""
            }
        },

        scores:{
            p1:0,
            p2:0
        },

        turn:"p1",

        lines:{},

        boxes:{},

        finished:false,

        vsComputer:false

    };

    openGame();

});



function makeLocalMove(key, player){

    if(!game || game.finished) return false;

    if(game.lines[key]) return false;

    game.lines[key] = player;

    const n = Number(game.size);

    let boxesCompleted = 0;

    for(let r=0;r<n-1;r++){

        for(let c=0;c<n-1;c++){

            const boxKey = r+"_"+c;

            if(game.boxes[boxKey]){

                continue;

            }

            const top = "h_"+r+"_"+c;

            const bottom = "h_"+(r+1)+"_"+c;

            const left = "v_"+r+"_"+c;

            const right = "v_"+r+"_"+(c+1);

            if(game.lines[top] && game.lines[bottom] && game.lines[left] && game.lines[right]){

                game.boxes[boxKey] = player;

                game.scores[player] = (game.scores[player] || 0) + 1;

                boxesCompleted++;

            }

        }

    }

    const allDone =
    Object.keys(game.lines).length ===
    2 * n * (n - 1);

    if(allDone){

        game.finished = true;

    }

    else if(boxesCompleted === 0){

        game.turn = game.turn === "p1" ? "p2" : "p1";

    }

    /* AI TURN-CHAIN FIX:
       Do NOT call applyComputerMove() from here. applyComputerMove
       owns its own turn-chain via chainNext() in its setTimeout
       callback, which runs AFTER computerThinking is cleared. */

    return true;

}





/* ================= GAME END ================= */

function handleGameEnd(){

    if(gameMode === "computer"){

        const p1Score = game.scores.p1;

        const p2Score = game.scores.p2;

        let text = "";

        if(p1Score > p2Score){

            text = "🏆 YOU WIN!";

        }

        else if(p2Score > p1Score){

            text = "🤖 COMPUTER WINS!";

        }

        else{

            text = "🤝 DRAW!";

        }

        document.getElementById("result").innerHTML = text + "<br>" +

        '<button class="btn create-btn" onclick="restartGame()" style="margin-top:10px;">PLAY AGAIN</button>' +

        '<button class="btn join-btn" onclick="goBack()" style="margin-top:10px;">CHANGE MODE</button>' +

        '<button class="back-btn" onclick="goHome()" style="margin-top:10px;">HOME</button>';

    }

    else if(gameMode === "offline"){

        const p1Name = getPlayerInfo("p1").name || "Player 1";

        const p2Name = getPlayerInfo("p2").name || "Player 2";

        const p1Score = game.scores.p1;

        const p2Score = game.scores.p2;

        let text = "";

        if(p1Score > p2Score){

            text = "🏆 " + p1Name + " Wins!";

        }

        else if(p2Score > p1Score){

            text = "🏆 " + p2Name + " Wins!";

        }

        else{

            text = "🤝 DRAW!";

        }

        document.getElementById("result").innerHTML = text + "<br>" +

        '<button class="btn create-btn" onclick="restartGame()" style="margin-top:10px;">PLAY AGAIN</button>' +

        '<button class="btn join-btn" onclick="goBack()" style="margin-top:10px;">CHANGE MODE</button>' +

        '<button class="back-btn" onclick="goHome()" style="margin-top:10px;">HOME</button>';

    }

    else{

        const p1Name = getPlayerInfo("p1").name || "Player 1";

        const p2Name = getPlayerInfo("p2").name || "Player 2";

        const p1Score = game.scores.p1;

        const p2Score = game.scores.p2;

        let text = "";

        if(p1Score > p2Score){

            text = "🏆 " + p1Name + " Wins!";

        }

        else if(p2Score > p1Score){

            text = "🏆 " + p2Name + " Wins!";

        }

        else{

            text = "🤝 DRAW!";

        }

        document.getElementById("result").innerHTML = text + "<br>" +

        '<button class="btn create-btn" onclick="restartGame()" style="margin-top:10px;">PLAY AGAIN</button>' +

        '<button class="btn join-btn" onclick="goBack()" style="margin-top:10px;">CHANGE MODE</button>' +

        '<button class="back-btn" onclick="goHome()" style="margin-top:10px;">HOME</button>';

    }

    document.getElementById("turnDisplay").textContent = "🏁 GAME FINISHED";

    if(!chatFinishAnnounced && gameMode === "online"){

        chatFinishAnnounced = true;

        renderChatMessage({ system: true, text: "🏁 Game finished" });

    }

    if(gameMode === "online"){

        updateGameStats();

    }

    scheduleResultCountdown();

}


function restartGame(){

    cancelResultCountdown();

    if(!game) return;

    if(computerTimer){

        clearTimeout(computerTimer);

        computerTimer = null;

    }

    computerThinking = false;

    const size = game.size;

    game = {

        size:size,

        gameId:roomCode,

        players: game.players,

        scores:{
            p1:0,
            p2:0
        },

        turn:"p1",

        lines:{},

        boxes:{},

        finished:false,

        vsComputer: gameMode === "computer"

    };

    resultRecorded = false;

    document.getElementById("result").textContent = "";

    document.getElementById("turnDisplay").textContent = "Waiting...";

    renderGame();

}



/* ================= MODE-SPECIFIC OPEN GAME ================= */

function openGame(){

    console.log("[DEBUG] openGame entered", {gameMode, gameExists:!!game, gameSize:game?game.size:null});
    try{

    resultRecorded = false;

    document.getElementById("setupScreen").style.display = "none";

    document.getElementById("gameScreen").style.display = "block";

    document.getElementById("roomDisplay").textContent =
    gameMode === "online" ? roomCode : "";

    const roomParent = document.getElementById("roomDisplay").parentElement;
    if(roomParent){
        roomParent.style.display =
        gameMode === "online" ? "block" : "none";
    }

    const chatPanel = document.getElementById("chatPanel");
    if(chatPanel){
        chatPanel.style.display =
        gameMode === "online" ? "block" : "none";
    }

    if(gameMode === "online"){

        setupChatListener();

    }

    else{

        cleanupChatListener();

    }

    renderGame();

    }
    catch(error){
        console.error("[openGame error]", error);
        const resultEl = document.getElementById("result");
        if(resultEl){
            resultEl.textContent = "⚠️ Game load error: " + (error.message || error);
        }
    }

}



/* ================= SHOW WINNER (MODE AWARE) ================= */

function showWinner(){

    const resultEl = document.getElementById("result");

    if(resultEl && resultEl.querySelector("button")){

        return;

    }

    let text = "";

    const p1Name = getPlayerInfo("p1").name;

    const p2Name = getPlayerInfo("p2").name;

    if(gameMode === "computer"){

        if(game.scores.p1 > game.scores.p2){

            text = "🏆 YOU WIN!";

        }

        else if(game.scores.p2 > game.scores.p1){

            text = "🤖 COMPUTER WINS!";

        }

        else{

            text = "🤝 DRAW!";

        }

    }

    else if(gameMode === "offline"){

        if(game.scores.p1 > game.scores.p2){

            text = "🏆 " + (p1Name || "Player 1") + " Wins!";

        }

        else if(game.scores.p2 > game.scores.p1){

            text = "🏆 " + (p2Name || "Player 2") + " Wins!";

        }

        else{

            text = "🤝 DRAW!";

        }

    }

    else{

        if(game.scores.p1 > game.scores.p2){

            text = "🏆 " + (p1Name || "Player 1") + " Wins!";

        }

        else if(game.scores.p2 > game.scores.p1){

            text = "🏆 " + (p2Name || "Player 2") + " Wins!";

        }

        else{

            text = "🤝 DRAW!";

        }

    }

    resultEl.textContent = text;

    document.getElementById("turnDisplay").textContent = "🏁 GAME FINISHED";

    if(!chatFinishAnnounced && gameMode === "online"){

        chatFinishAnnounced = true;

        renderChatMessage({ system: true, text: "🏁 Game finished" });

    }

    if(gameMode === "online"){

        const mySlot = myPlayer;

        const oppSlot = mySlot === "p1" ? "p2" : "p1";

        const myScore = Number(game.scores[mySlot]) || 0;

        const oppScore = Number(game.scores[oppSlot]) || 0;

        let result;

        if(myScore > oppScore) result = "win";

        else if(myScore < oppScore) result = "loss";

        else result = "draw";

        recordResultIdempotent(result);

        scheduleResultCountdown();

    }

}


/* ================= UPDATE GAME STATS ================= */

function recordResultIdempotent(result){
    updateGameStats();
}


function updateGameStats(){

    if(!currentUser || !game || !game.finished) return;

    if(!game.gameId) return;

    if(resultRecorded) return;

    if(gameMode !== "online") return;

    const mySlot = myPlayer;

    if(!mySlot) return;

    const myScore = Number(game.scores[mySlot]) || 0;

    const oppSlot = mySlot === "p1" ? "p2" : "p1";

    const oppScore = Number(game.scores[oppSlot]) || 0;

    let result;

    if(myScore > oppScore) result = "win";

    else if(myScore < oppScore) result = "loss";

    else result = "draw";

    const gameId = game.gameId;

    const uid = currentUser.uid;

    const boxes = myScore;

    resultRecorded = true;

    const markerRef = db.ref("gameResults/" + gameId + "/" + uid);

    markerRef.transaction(function(current){

        if(current) return current;

        return { recorded: true, result: result, boxes: boxes };

    }).then(function(res){

        if(res.committed){

            return updateStats(uid, result, boxes);

        }

    }).catch(function(error){

        console.error(error);

        resultRecorded = false;

    });

}


/* ================= MOVE DISPATCHER ================= */

async function makeMove(key, player){

    if(gameMode === "online" || !gameMode){

        return makeOnlineMove(key);

    }

    return makeLocalMove(key, player || game.turn);

}

