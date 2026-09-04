/* ================= RENDER ================= */

function renderGame(){

    console.log("[DEBUG] renderGame entered", {gameExists:!!game, gameSize:game?game.size:null});
    try{

    if(!game){
        return;
    }

    if(!game.scores) game.scores = {p1:0, p2:0};
    if(!game.players) game.players = {p1:"", p2:""};
    if(!game.lines) game.lines = {};
    if(!game.boxes) game.boxes = {};
    if(typeof game.finished === "undefined") game.finished = false;
    if(!game.turn) game.turn = "p1";

    const p1 = getPlayerInfo("p1");
    const p2 = getPlayerInfo("p2");

    renderUserAvatar(
        document.getElementById("p1AvatarWrap"),
        p1
    );

    renderUserAvatar(
        document.getElementById("p2AvatarWrap"),
        p2
    );

    document
    .getElementById("p1Display")
    .textContent =
    p1.name || "Player 1";


    document
    .getElementById("p2Display")
    .textContent =
    p2.name ||
    "Waiting...";


    document
    .getElementById("p1Score")
    .textContent =
    game.scores.p1;


    document
    .getElementById("p2Score")
    .textContent =
    game.scores.p2;


    if(!game.players.p2 || (typeof game.players.p2 === "string" && !game.players.p2)){

        document
        .getElementById("turnDisplay")
        .textContent =
        "⏳ Waiting for Player 2...";

    }

    else if(game.finished){

        showWinner();
        updateGameStats();

    }

    else if(gameMode === "offline"){

        const name =
        game.turn === "p1"
        ? p1.name
        : p2.name;

        document
        .getElementById("turnDisplay")
        .textContent =
        "🔵 "+(name || "Player")+"'S TURN";

    }

    else if(game.turn === myPlayer){

        document
        .getElementById("turnDisplay")
        .textContent =
        "🟢 YOUR TURN";

    }

    else{

        const name =
        game.turn === "p1"
        ? p1.name
        : p2.name;


        document
        .getElementById("turnDisplay")
        .textContent =
        "🔴 "+(name || "Player")+"'S TURN";

    }


    drawBoard();

    }
    catch(error){
        console.error("[renderGame error]", error);
        throw error;
    }

}


/* ================= DRAW BOARD ================= */

function drawBoard(){

    console.log("[DEBUG] drawBoard entered", {gameExists:!!game, gameSize:game?game.size:null, boardEl:!!document.getElementById("gameBoard")});
    try{

    if(!game) return;

    const board =
    document.getElementById("gameBoard");

    if(!board) return;


    board.innerHTML = "";


    const n =
    Number(game.size);


    if(!n || n < 2) return;


    const width =
    Math.min(
        600,
        window.innerWidth - 50
    );


    const gap =
    width / (n-1);


    board.style.width =
    width+"px";


    board.style.height =
    width+"px";


    /* ================= BOXES ================= */

    if(game.boxes){

        Object.keys(game.boxes)
        .forEach(key => {

            const parts =
            key.split("_");


            const r =
            Number(parts[0]);


            const c =
            Number(parts[1]);


            const box =
            document.createElement("div");


            box.className =
            "box "+
            game.boxes[key];


            box.style.left =
            (c*gap+8)+"px";


            box.style.top =
            (r*gap+8)+"px";


            box.style.width =
            (gap-16)+"px";


            box.style.height =
            (gap-16)+"px";


            const owner =
            game.boxes[key];


            const info =
            getPlayerInfo(owner);


            const playerName =
            info.name;


            box.textContent =
            playerName
            ? playerName.charAt(0).toUpperCase()
            : "";


            board.appendChild(box);

        });

    }


    /* ================= HORIZONTAL ================= */

    for(let r=0;r<n;r++){

        for(let c=0;c<n-1;c++){

            const key =
            "h_"+r+"_"+c;


            createLine(
                key,
                c*gap,
                r*gap-4,
                gap,
                9,
                "horizontal"
            );

        }

    }


    /* ================= VERTICAL ================= */

    for(let r=0;r<n-1;r++){

        for(let c=0;c<n;c++){

            const key =
            "v_"+r+"_"+c;


            createLine(
                key,
                c*gap-4,
                r*gap,
                9,
                gap,
                "vertical"
            );

        }

    }


    /* ================= DOTS ================= */

    for(let r=0;r<n;r++){

        for(let c=0;c<n;c++){

            const dot =
            document.createElement("div");


            dot.className =
            "dot";


            dot.style.left =
            c*gap+"px";


            dot.style.top =
            r*gap+"px";


            board.appendChild(dot);

        }

    }

    }
    catch(error){
        console.error("[drawBoard error]", error);
        throw error;
    }

}


/* ================= CREATE LINE ================= */

function createLine(
    key,
    left,
    top,
    width,
    height,
    type
){

    const line =
    document.createElement("div");


    line.className =
    "line "+type;


    line.dataset.key =
    key;


    line.style.left =
    left+"px";


    line.style.top =
    top+"px";


    line.style.width =
    width+"px";


    line.style.height =
    height+"px";


    if(game.lines &&
       game.lines[key]){

        line.classList.add(
            game.lines[key]
        );

    }


    document
    .getElementById("gameBoard")
    .appendChild(line);

}


/* ================= MAKE MOVE ================= */
