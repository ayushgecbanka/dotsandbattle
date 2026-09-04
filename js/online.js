/* ================= CREATE ROOM ================= */

document
.getElementById("createRoom")
.addEventListener("click", async function(){

    if(!firebaseLoaded){

        document.getElementById("status")
        .textContent =
        "⏳ Firebase loading... 1 second wait karo.";

        return;

    }

    if(!currentUser){

        document.getElementById("status")
        .textContent =
        "⚠️ Sign in with Google first.";

        return;

    }

    await createRoomCore();

});


async function createRoomCore(nameOverride){

    if(!firebaseLoaded) return false;

    roomCode =
    Math.random()
    .toString(36)
    .substring(2,8)
    .toUpperCase();


    myPlayer = "p1";

    const name =
    nameOverride ||
    (myProfile && myProfile.displayName) ||
    (currentUser && currentUser.displayName) ||
    "Player";

    game = {

        size:selectedSize,

        gameId:roomCode,

        players:{
            p1:buildPlayerObject(name),
            p2:""
        },

        scores:{
            p1:0,
            p2:0
        },

        turn:"p1",

        lines:{},

        boxes:{},

        finished:false

    };


    try{

        await db
        .ref("rooms/"+roomCode)
        .set(game);


        openGame();

        listenRoom();

        return true;

    }
    catch(error){

        console.error(error);

        setStatus("❌ Room create error.");

        return false;

    }

}


/* ================= JOIN ROOM ================= */

document
.getElementById("joinRoom")
    .addEventListener("click", async function(){

        const code =
        document.getElementById("roomInput")
        .value
        .trim()
        .toUpperCase();


        if(!code){

            document.getElementById("status")
            .textContent =
            "⚠️ Room code enter karo.";

            return;

        }


        if(!firebaseLoaded){

            document.getElementById("status")
            .textContent =
            "⏳ Firebase loading...";

            return;

        }


        const name =
        (myProfile && myProfile.displayName) ||
        (currentUser && currentUser.displayName) ||
        "Player";

        await performJoin(code, name);

    });


async function performJoin(code, name){

    if(!firebaseLoaded) return false;

    try{

        const snapshot =
        await db
        .ref("rooms/"+code)
        .once("value");


        if(!snapshot.exists()){

            setStatus("❌ Room nahi mila.");
            return false;

        }


        const data =
        snapshot.val();


        if(data.players.p2){

            setStatus("❌ Room already full hai.");
            return false;

        }


        roomCode = code;

        myPlayer = "p2";


        game = data;


        await db
        .ref(
            "rooms/"+roomCode+
            "/players/p2"
        )
        .set(buildPlayerObject(name));


        openGame();

        listenRoom();

        sendSystemMessage((myProfile && myProfile.displayName ? myProfile.displayName : name) + " joined the room");

        return true;

    }
    catch(error){

        console.error(error);

        setStatus("❌ Join error.");

        return false;

    }

}


function cleanupRoomListeners(){

    if(roomRef){
        roomRef.off();
        roomRef = null;
    }

    if(roomPresenceRef){
        roomPresenceRef.off();
        roomPresenceRef = null;
    }

    if(disconnectTimer){
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
    }

}


/* ================= LISTEN ================= */

function listenRoom(){

    if(roomRef){
        roomRef.off();
        roomRef = null;
    }

    if(roomPresenceRef){
        roomPresenceRef.off();
        roomPresenceRef = null;
    }

    if(disconnectTimer){

        clearTimeout(disconnectTimer);

        disconnectTimer = null;

    }

    roomRef = db.ref("rooms/"+roomCode);

    roomRef.on("value", snapshot => {

        if(!snapshot.exists()){

            return;

        }


        game =
        snapshot.val();


        if(!game) return;


        if(game.status === "forfeited" || game.status === "abandoned"){

            handleForfeitResult(game);

            return;

        }

        if(game.finished && !playerLeft){

            handleGameEnd();

            return;

        }

        renderGame();

        if(gameMode === "online" && game.players && !game.finished){

            const oppSlot = myPlayer === "p1" ? "p2" : "p1";

            const opp = game.players[oppSlot];

            if(opp && opp.uid){

                if(roomPresenceRef){
                    roomPresenceRef.off();
                    roomPresenceRef = null;
                }

                roomPresenceRef = db.ref("presence/" + opp.uid);

                roomPresenceRef.on("value", function(snap){

                    const p = snap.val() || {};

                    if(p.state !== "online" && !disconnectTimer && !playerLeft && !game.finished){

                        startDisconnectGracePeriod(oppSlot);

                    }

                    else if(p.state === "online" && disconnectTimer){

                        clearTimeout(disconnectTimer);

                        disconnectTimer = null;

                        renderChatMessage({ system: true, text: "✓ Opponent reconnected" });

                    }

                });

            }

        }

    });

}


function startDisconnectGracePeriod(opponentSlot){

    if(disconnectTimer){

        clearTimeout(disconnectTimer);

    }

    const opponentName = getPlayerInfo(opponentSlot).name || "Opponent";

    renderChatMessage({ system: true, text: "⚠️ " + opponentName + " disconnected. Waiting for reconnection..." });

    disconnectTimer = setTimeout(function(){

        disconnectTimer = null;

        if(!game || game.finished || playerLeft) return;

        const me = currentUser.uid;

        const mySlot = myPlayer;

        const updates = {};

        updates["rooms/" + roomCode + "/status"] = "abandoned";

        updates["rooms/" + roomCode + "/finished"] = true;

        updates["rooms/" + roomCode + "/resultReason"] = "disconnect";

        updates["rooms/" + roomCode + "/winner"] = mySlot;

        updates["rooms/" + roomCode + "/loser"] = opponentSlot;

        db.ref().update(updates).catch(function(e){ console.error(e); });

        renderChatMessage({ system: true, text: "🏁 " + opponentName + " did not reconnect. You win by forfeit." });

        handleForfeitResult({

            winner: mySlot,

            loser: opponentSlot,

            resultReason: "disconnect"

        });

    }, DISCONNECT_GRACE_PERIOD);

}




/* ================= MAKE MOVE ================= */

async function makeOnlineMove(key){

    if(!game) return;


    if(!game.players.p2) return;


    if(game.finished) return;


    /* ONLY CURRENT PLAYER */

    if(game.turn !== myPlayer){

        return;

    }


    /* LINE ALREADY USED */

    if(game.lines &&
       game.lines[key]){

        return;

    }


    const roomRef =
    db.ref("rooms/"+roomCode);


    await roomRef.transaction(
    function(current){

        if(!current) return current;


        /* SERVER-SIDE TURN CHECK */

        if(current.turn !== myPlayer){

            return;

        }


        if(current.finished){

            return;

        }


        if(!current.lines){

            current.lines = {};

        }


        if(current.lines[key]){

            return;

        }


        if(!current.boxes){

            current.boxes = {};

        }


        if(!current.scores){

            current.scores = {
                p1:0,
                p2:0
            };

        }


        /* DRAW LINE */

        current.lines[key] =
        myPlayer;


        let boxesMade = 0;


        const n =
        Number(current.size);


        /* CHECK ALL BOXES */

        for(let r=0;r<n-1;r++){

            for(let c=0;c<n-1;c++){

                const boxKey =
                r+"_"+c;


                if(current.boxes[boxKey]){

                    continue;

                }


                const top =
                "h_"+r+"_"+c;


                const bottom =
                "h_"+(r+1)+"_"+c;


                const left =
                "v_"+r+"_"+c;


                const right =
                "v_"+r+"_"+(c+1);


                if(
                    current.lines[top] &&
                    current.lines[bottom] &&
                    current.lines[left] &&
                    current.lines[right]
                ){

                    current.boxes[boxKey] =
                    myPlayer;


                    current.scores[myPlayer]++;


                    boxesMade++;

                }

            }

        }


        /* ================= TURN LOGIC ================= */


        /*
            Box bana:
            same player ka turn.

            Box nahi bana:
            opponent ka turn.
        */

        if(boxesMade === 0){

            current.turn =
            myPlayer === "p1"
            ? "p2"
            : "p1";

        }


        /* ================= FINISH ================= */

        const totalBoxes =
        Object.keys(
            current.boxes
        ).length;


        const requiredBoxes =
        (n-1)*(n-1);


        if(
            totalBoxes >=
            requiredBoxes
        ){

            current.finished =
            true;

            current.turn =
            "";

        }


        return current;

    }).then(function(res){
        if(res && res.committed){
            renderGame();
            if(game && game.finished && !playerLeft){
                handleGameEnd();
            }
        }
    }).catch(function(error){
        console.error("[makeOnlineMove error]", error);
        showNotification("❌ Move failed: " + (error.message || "Network error"));
    });

}


/* ================= ROOM LIFECYCLE ================= */

async function handleLocalForfeit(){

    if(gameMode !== "online" || !roomCode || !db || !currentUser) return;

    if(playerLeft) return;

    playerLeft = true;

    resultReason = "forfeit";

    const me = currentUser.uid;

    const opponentSlot = myPlayer === "p1" ? "p2" : "p1";

    const opponentUid = game && game.players && game.players[opponentSlot] && game.players[opponentSlot].uid;

    const updates = {};

    updates["rooms/" + roomCode + "/status"] = "forfeited";

    updates["rooms/" + roomCode + "/finished"] = true;

    updates["rooms/" + roomCode + "/resultReason"] = "forfeit";

    updates["rooms/" + roomCode + "/winner"] = opponentSlot;

    updates["rooms/" + roomCode + "/loser"] = myPlayer;

    if(opponentUid){

        updates["rooms/" + roomCode + "/players/" + myPlayer + "/left"] = true;

    }

    await db.ref().update(updates).catch(function(e){ console.error(e); });

    showForfeitResult();

    recordResultIdempotent("loss");

    scheduleAutoHome();

}


function showForfeitResult(){

    document.getElementById("result").innerHTML = "❌ GAME FORFEITED<br>You left the game.<br>This match counts as a loss.<br>" +

        '<button class="btn back-btn" onclick="goHome()" style="margin-top:10px;">HOME</button>';

    document.getElementById("turnDisplay").textContent = "🏁 GAME FORFEITED";

    if(!chatFinishAnnounced){

        chatFinishAnnounced = true;

        renderChatMessage({ system: true, text: "🚪 You left the game. Opponent wins by forfeit." });

    }

}


function handleForfeitResult(roomData){

    if(playerLeft) return;

    const winner = roomData.winner;

    const loser = roomData.loser;

    const reason = roomData.resultReason || "forfeit";

    const mySlot = myPlayer;

    const opponentSlot = mySlot === "p1" ? "p2" : "p1";

    const iWon = winner === mySlot;

    const opponentName = getPlayerInfo(opponentSlot).name || "Opponent";

    let text = "";

    if(iWon){

        text = "🏆 YOU WIN BY FORFEIT!<br>" + opponentName + " left the game.<br>You win by forfeit.";

    }

    else{

        text = "🤝 " + opponentName + " Wins!<br>You left the game.<br>You forfeited.";

    }

    document.getElementById("result").innerHTML = text + "<br>" +

        '<button class="btn back-btn" onclick="goHome()" style="margin-top:10px;">HOME</button>';

    document.getElementById("turnDisplay").textContent = "🏁 GAME FINISHED";

    if(!chatFinishAnnounced){

        chatFinishAnnounced = true;

        renderChatMessage({ system: true, text: "🏁 Game finished" });

    }

    if(iWon){

        recordResultIdempotent("win");

    }

    else{

        recordResultIdempotent("loss");

    }

    scheduleAutoHome();

}


function scheduleAutoHome(){

    if(resultHomeTimer){

        clearTimeout(resultHomeTimer);

    }

    resultHomeTimer = setTimeout(function(){

        resultHomeTimer = null;

        goHome();

    }, RESULT_HOME_DELAY);

}


