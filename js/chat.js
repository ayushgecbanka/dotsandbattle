/* ================= CHAT ================= */

function getChatSender(){

    if(currentUser && myProfile){
        return {
            uid: currentUser.uid,
            username: myProfile.username || "",
            displayName: myProfile.displayName || currentUser.displayName || "Player",
            photoURL: myProfile.photoURL || "",
            avatarType: myProfile.avatarType || "google",
            avatarId: myProfile.avatarId || ""
        };
    }

    const p = game && game.players ? game.players[myPlayer] : null;
    let name = "Player";
    if(typeof p === "string") name = p;
    else if(p && p.name) name = p.name;

    return {
        uid: myPlayer || "guest",
        username: name,
        displayName: name,
        photoURL: "",
        avatarType: "google",
        avatarId: ""
    };

}


function setupChatListener(){

    cleanupChatListener();

    if(!roomCode || !db) return;

    chatFinishAnnounced = false;

    chatRef = db.ref("rooms/" + roomCode + "/chat").limitToLast(50);

    chatCallback = chatRef.on("child_added", function(snapshot){

        const data = snapshot.val();
        if(!data) return;

        renderChatMessage(data);

        if(!data.system && data.uid !== getChatSender().uid){
            if(!chatFocused || !document.hasFocus()){
                unreadCount++;
                updateUnreadCount();
            }
        }

        scrollChatToBottom();

    });

}


function closeGifPicker(){
}


function cleanupChatListener(){

    closeStickerPicker();
    closeGifPicker();

    if(chatRef && chatCallback){
        chatRef.off("child_added", chatCallback);
    }
    else if(chatRef){
        chatRef.off();
    }

    chatRef = null;
    chatCallback = null;

    const box = document.getElementById("chatMessages");
    if(box) box.innerHTML = "";

    unreadCount = 0;
    updateUnreadCount();

}


function sendChatMessage(){

    const input = document.getElementById("chatInput");
    if(!input) return;

    let text = (input.value || "").trim();
    if(!text) return;
    if(text.length > 200) text = text.substring(0, 200);

    if(gameMode !== "online" || !roomCode || !db) return;

    const sender = getChatSender();

    const messageData = {
        type: "text",
        uid: sender.uid,
        username: sender.username,
        displayName: sender.displayName,
        photoURL: sender.photoURL,
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    db.ref("rooms/" + roomCode + "/chat")
        .push()
        .set(messageData)
        .catch(function(error){
            console.error(error);
        });

    input.value = "";
    updateCounter();

}


function sendSystemMessage(text){

    if(gameMode !== "online" || !roomCode || !db) return;

    db.ref("rooms/" + roomCode + "/chat")
        .push()
        .set({
            system: true,
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        })
        .catch(function(error){
            console.error(error);
        });

}


function renderChatMessage(data){

    const box = document.getElementById("chatMessages");
    if(!box) return;

    if(data.system){
        const sys = document.createElement("div");
        sys.className = "chat-system";
        sys.textContent = data.text;
        box.appendChild(sys);
        return;
    }

    const mine = data.uid === getChatSender().uid;

    const wrap = document.createElement("div");
    wrap.className = "chat-msg " + (mine ? "mine" : "theirs");

    const meta = document.createElement("div");
    meta.className = "chat-meta";

    const avatarWrap = document.createElement("span");
    avatarWrap.className = "chat-avatar";
    const avatarInfo = {
        photoURL: data.photoURL || "",
        avatarType: data.avatarType || "google",
        avatarId: data.avatarId || "",
        name: data.displayName || data.username || "Player"
    };
    renderUserAvatar(avatarWrap, avatarInfo);

    const name = document.createElement("span");
    name.className = "chat-name";
    name.textContent = mine ? "You" : (data.displayName || data.username || "Player");

    const time = document.createElement("span");
    time.className = "chat-time";
    time.textContent = formatTime(data.timestamp);

    meta.appendChild(avatarWrap);
    meta.appendChild(name);
    meta.appendChild(time);

    let body;

    if(data.type === "sticker" && data.sticker){
        body = document.createElement("div");
        body.className = "chat-sticker";
        body.textContent = data.sticker;
    }
    else {
        body = document.createElement("div");
        body.className = "chat-text";
        body.textContent = data.text;
    }

    wrap.appendChild(meta);
    wrap.appendChild(body);

    box.appendChild(wrap);

}


function formatTime(ts){

    if(!ts) return "";
    const d = new Date(ts);
    if(isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

}


function scrollChatToBottom(){

    const box = document.getElementById("chatMessages");
    if(box) box.scrollTop = box.scrollHeight;

}


function updateUnreadCount(){

    const el = document.getElementById("chatUnread");
    if(!el) return;

    if(unreadCount > 0){
        el.textContent = unreadCount + " New";
        el.style.display = "inline-block";
    }
    else{
        el.textContent = "";
        el.style.display = "none";
    }

}


function clearUnreadCount(){
    unreadCount = 0;
    updateUnreadCount();
}


function updateCounter(){

    const input = document.getElementById("chatInput");
    const counter = document.getElementById("chatCounter");
    if(input && counter){
        counter.textContent = input.value.length + " / 200";
    }

}


function initializeChat(){

    const input = document.getElementById("chatInput");
    const send = document.getElementById("chatSend");
    if(!input || !send) return;

    input.addEventListener("input", function(){
        updateCounter();
        resizeChatInput();
    });

    input.addEventListener("keydown", function(e){
        if(e.key === "Enter" && !e.shiftKey){
            e.preventDefault();
            sendChatMessage();
        }
    });

    input.addEventListener("focus", function(){
        chatFocused = true;
        clearUnreadCount();
    });

    input.addEventListener("blur", function(){
        chatFocused = false;
    });

    send.addEventListener("click", sendChatMessage);

    const stickerBtn = document.getElementById("stickerBtn");

    if(stickerBtn){
        stickerBtn.addEventListener("click", openStickerPicker);
    }

    document.addEventListener("keydown", function(e){
        if(e.key === "Escape"){
            closeStickerPicker();
        }
    });

    document.addEventListener("click", function(e){
        const t = e.target;
        if(t && t.closest){
            if(t.closest("#stickerPicker")) return;
        }
        if(t && t.id === "stickerBtn") return;
        closeStickerPicker();
    });

    updateCounter();
    resizeChatInput();

}


initializeChat();

initializeFriends();


/* ================= STICKERS ================= */

const STICKERS = [
    "😂","😎","🤣","🔥","❤️","😭",
    "😡","😱","🤯","👏","👍","👎",
    "🎉","💀","🤝","😈","🥳","😍",
    "⚡","👑","💯","🙈","🤔","😴"
];


function isStickerAllowed(s){
    return STICKERS.indexOf(s) !== -1;
}


function openStickerPicker(){
    renderStickerGrid();
    document.getElementById("stickerPicker").style.display = "block";
}


function closeStickerPicker(){
    const p = document.getElementById("stickerPicker");
    if(p) p.style.display = "none";
}


function stickerItem(s){
    const el = document.createElement("div");
    el.className = "sticker-item";
    el.textContent = s;
    el.title = s;
    el.addEventListener("click", function(){
        sendSticker(s);
    });
    return el;
}


function renderStickerGrid(){
    const grid = document.getElementById("stickerGrid");
    if(!grid) return;
    grid.innerHTML = "";

    const recent = loadRecentStickers();
    if(recent.length){
        const rl = document.createElement("div");
        rl.className = "sticker-section-label";
        rl.textContent = "Recent";
        grid.appendChild(rl);
        recent.forEach(s => grid.appendChild(stickerItem(s)));
    }

    const tl = document.createElement("div");
    tl.className = "sticker-section-label";
    tl.textContent = "Stickers";
    grid.appendChild(tl);

    STICKERS.forEach(s => grid.appendChild(stickerItem(s)));
}


function sendSticker(sticker){
    if(!isStickerAllowed(sticker)) return;
    if(gameMode !== "online" || !roomCode || !db) return;

    const sender = getChatSender();

    const data = {
        type: "sticker",
        sticker: sticker,
        uid: sender.uid,
        username: sender.username,
        displayName: sender.displayName,
        photoURL: sender.photoURL,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    db.ref("rooms/" + roomCode + "/chat").push().set(data)
        .catch(function(error){ console.error(error); });

    saveRecentSticker(sticker);
    closeStickerPicker();
}


/* ================= RECENT (localStorage) ================= */

function loadRecentStickers(){
    try{
        const raw = localStorage.getItem("dotsBattleRecentStickers");
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    }
    catch(e){
        return [];
    }
}


function saveRecentSticker(s){
    try{
        const arr = loadRecentStickers().filter(function(x){
            return x !== s;
        });
        arr.unshift(s);
        while(arr.length > 10) arr.pop();
        localStorage.setItem("dotsBattleRecentStickers", JSON.stringify(arr));
    }
    catch(e){}
}


function resizeChatInput(){
    const el = document.getElementById("chatInput");
    if(!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 80) + "px";
}

