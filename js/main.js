/* ================= VARIABLES ================= */

let selectedSize = 4;

let roomCode = "";

let myPlayer = "";

let game = null;

let firebaseLoaded = false;

let currentUser = null;

let myProfile = null;

let resultRecorded = false;

let chatRef = null;

let chatCallback = null;

let unreadCount = 0;

let chatFocused = false;

let chatFinishAnnounced = false;

let gameMode = "";

let computerThinking = false;

let computerTimer = null;

let selectedDifficulty = "medium";

let selectedAvatarCategory = "boys";

let selectedAvatarId = null;

let roomStatus = "";

let playerLeft = false;

let resultReason = "";

let autoHomeTimer = null;

let disconnectTimer = null;

let resultHomeTimer = null;

let roomPresenceRef = null;
let roomRef = null;

const RESULT_HOME_DELAY = 3000;

const DISCONNECT_GRACE_PERIOD = 12000;


/* ================= SIZE BUTTONS ================= */

const sizeButtons =
document.querySelectorAll(".size-btn");


sizeButtons.forEach(button => {

    button.addEventListener("click", function(){

        if(!this.dataset.size) return;

        sizeButtons.forEach(btn => {

            btn.classList.remove("selected");

        });

        this.classList.add("selected");

        selectedSize =
        Number(this.dataset.size);

        document.getElementById("status")
        .textContent =
        "Selected: " +
        selectedSize +
        " × " +
        selectedSize;

    });

});


/* ================= BOARD INTERACTION ================= */

document.getElementById("gameBoard").addEventListener("click", function(e){

    if(!game || game.finished) return;

    if(gameMode === "computer" && (game.turn === "p2" || computerThinking)){

        return;

    }

    const lineEl = e.target.closest(".line");

    if(!lineEl) return;

    const key = lineEl.dataset.key;

    if(!key || game.lines[key]) return;

    if(gameMode === "online"){

        makeOnlineMove(key);

    }

    else{

        const success = makeLocalMove(key, game.turn);

        if(success){

            renderGame();

            if(game.finished){

                handleGameEnd();

            }
            else if(gameMode === "computer" && game.turn === "p2" && !computerThinking){

                applyComputerMove();

            }

        }

    }

});



/* ================= BACK HOME ================= */

document.getElementById("backHome").addEventListener("click",function(){

    goBack();

});


window.addEventListener("popstate", function(e){

    if(gameMode === "online" && game && !game.finished && !playerLeft){

        goBack();

        e.preventDefault();

    }

});


window.addEventListener("beforeunload", function(e){

    if(gameMode === "online" && game && !game.finished && !playerLeft){

        handleLocalForfeit();

    }

});



/* ================= INITIALIZE MODE SCREEN ================= */

function initializeModeScreen(){

    document.getElementById("modeScreen").style.display = "block";

    document.getElementById("computerSetup").style.display = "none";

    document.getElementById("offlineSetup").style.display = "none";

    document.getElementById("onlineSetup").style.display = "none";

}


if(document.readyState === "loading"){

    document.addEventListener("DOMContentLoaded", initializeModeScreen);

}

else{

    initializeModeScreen();

}

