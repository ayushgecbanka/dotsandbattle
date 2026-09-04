/* ================= FRIENDS SYSTEM ================= */

let friendsRef = null;
let friendRequestsRef = null;
let gameInvitesRef = null;
let presenceConnectedRef = null;
let currentFriends = {};
let presenceRefs = {};
let friendsTab = "friends";
let friendSearchTimer = null;

let lastFriendSearchTime = 0;

const FRIEND_SEARCH_COOLDOWN_MS = 1000;
let activeFriendUid = null;

const GAME_INVITE_TTL = 10 * 60 * 1000;

const INVITE_COOLDOWN_MS = 20 * 1000;

let activeGameInvitesRef = null;

let inviteCountdownTimers = {};


function isExpired(ts){
    if(!ts) return false;
    return (Date.now() - ts) > GAME_INVITE_TTL;
}


function isInviteExpiredByExpiresAt(expiresAt){
    if(!expiresAt) return true;
    return Date.now() > expiresAt;
}


function getActiveInvitePath(receiverUid, senderUid){
    return "activeGameInvites/" + receiverUid + "/" + senderUid;
}


function getActiveInviteSenderPath(senderUid, receiverUid){
    return "activeGameInvites/" + senderUid + "/" + receiverUid;
}


async function getActiveInvite(receiverUid, senderUid){
    if(!db) return null;
    const snap = await db.ref(getActiveInvitePath(receiverUid, senderUid)).once("value");
    return snap.val() || null;
}


async function getSentActiveInvite(senderUid, receiverUid){
    if(!db) return null;
    const snap = await db.ref(getActiveInviteSenderPath(senderUid, receiverUid)).once("value");
    return snap.val() || null;
}


async function canSendInvite(friendUid){
    if(!currentUser || !db) return false;
    const me = currentUser.uid;
    const active = await getSentActiveInvite(me, friendUid);
    if(!active) return true;
    if(active.status === "pending" && active.expiresAt && Date.now() < active.expiresAt){
        return false;
    }
    if(active.status === "pending" && active.expiresAt && Date.now() >= active.expiresAt){
        await db.ref(getActiveInviteSenderPath(me, friendUid)).remove();
        await db.ref(getActiveInvitePath(friendUid, me)).remove();
        return true;
    }
    return true;
}


async function cleanupStaleInvites(){
    if(!currentUser || !db) return;
    const me = currentUser.uid;
    const snap = await db.ref("activeGameInvites/" + me).once("value");
    const data = snap.val() || {};
    const updates = {};
    let changed = false;
    for(const senderUid in data){
        const inv = data[senderUid];
        if(!inv) continue;
        if(inv.status === "pending" && inv.expiresAt && Date.now() > inv.expiresAt){
            updates["activeGameInvites/" + me + "/" + senderUid] = { status: "expired" };
            updates[getActiveInviteSenderPath(senderUid, me)] = { status: "expired" };
            changed = true;
        }
    }
    if(changed){
        await db.ref().update(updates);
    }
}


function deduplicateInvites(invites){
    const bySender = {};
    const list = Object.keys(invites).map(function(id){
        return Object.assign({ inviteId: id }, invites[id]);
    });
    list.forEach(function(inv){
        const key = inv.fromUid || "";
        if(!bySender[key] || (inv.createdAt || 0) > (bySender[key].createdAt || 0)){
            bySender[key] = inv;
        }
    });
    return bySender;
}


function formatLastSeen(ts){
    if(!ts) return "unknown";
    const diff = Date.now() - ts;
    if(diff < 60000) return "just now";
    const min = Math.floor(diff / 60000);
    if(min < 60) return min + (min === 1 ? " minute ago" : " minutes ago");
    const hr = Math.floor(min / 60);
    if(hr < 24) return hr + (hr === 1 ? " hour ago" : " hours ago");
    const day = Math.floor(hr / 24);
    if(day === 1) return "yesterday";
    if(day < 7) return day + " days ago";
    return new Date(ts).toLocaleDateString();
}


function initializePresence(){

    if(!currentUser || !db) return;

    const uid = currentUser.uid;
    const presenceRef = db.ref("presence/" + uid);
    const connectedRef = db.ref(".info/connected");

    presenceConnectedRef = connectedRef;

    connectedRef.on("value", function(snap){
        if(snap.val() === true){
            presenceRef.update({
                state: "online",
                lastChanged: firebase.database.ServerValue.TIMESTAMP
            });
            presenceRef.onDisconnect().update({
                state: "offline",
                lastChanged: firebase.database.ServerValue.TIMESTAMP
            });
        }
    });

}


function stopPresence(){

    if(presenceConnectedRef){
        presenceConnectedRef.off();
        presenceConnectedRef = null;
    }

    if(currentUser && db){
        db.ref("presence/" + currentUser.uid).update({
            state: "offline",
            lastChanged: firebase.database.ServerValue.TIMESTAMP
        });
    }

}


function cleanupFriendsListeners(){

    if(friendsRef){ friendsRef.off(); friendsRef = null; }
    if(friendRequestsRef){ friendRequestsRef.off(); friendRequestsRef = null; }
    if(gameInvitesRef){ gameInvitesRef.off(); gameInvitesRef = null; }
    if(activeGameInvitesRef){ activeGameInvitesRef.off(); activeGameInvitesRef = null; }

    for(const uid in presenceRefs){
        presenceRefs[uid].off();
    }
    presenceRefs = {};

    currentFriends = {};

    for(const id in inviteCountdownTimers){
        clearInterval(inviteCountdownTimers[id]);
    }
    inviteCountdownTimers = {};

}


function initializeFriendsListeners(){

    if(!currentUser || !db) return;

    const uid = currentUser.uid;

    friendsRef = db.ref("friends/" + uid);
    friendsRef.on("value", function(snapshot){
        currentFriends = snapshot.val() || {};
        managePresenceListeners();
        updateFriendsCounts();
        if(document.getElementById("friendsModal").classList.contains("open")
           && friendsTab === "friends"){
            renderFriends();
        }
    });

    friendRequestsRef = db.ref("friendRequests/" + uid);
    friendRequestsRef.on("value", function(){
        if(document.getElementById("friendsModal").classList.contains("open")
           && friendsTab === "requests"){
            renderFriendRequests();
        }
        updateFriendsBadges();
    });

    gameInvitesRef = db.ref("gameInvites/" + uid);
    gameInvitesRef.on("value", function(){
        if(document.getElementById("friendsModal").classList.contains("open")
           && friendsTab === "invites"){
            renderGameInvites();
        }
        updateFriendsBadges();
    });

    cleanupStaleInvites().then(function(){
        setupActiveInviteListener();
    });

}


function setupActiveInviteListener(){

    if(!currentUser || !db) return;
    if(activeGameInvitesRef){
        activeGameInvitesRef.off();
        activeGameInvitesRef = null;
    }

    const uid = currentUser.uid;
    activeGameInvitesRef = db.ref("activeGameInvites/" + uid);
    activeGameInvitesRef.on("value", function(){
        if(document.getElementById("friendsModal").classList.contains("open")
           && friendsTab === "invites"){
            renderGameInvites();
        }
        updateFriendsBadges();
    });
}


function managePresenceListeners(){

    const uids = Object.keys(currentFriends || {});

    for(const uid in presenceRefs){
        if(uids.indexOf(uid) === -1){
            presenceRefs[uid].off();
            delete presenceRefs[uid];
        }
    }

    uids.forEach(function(uid){
        if(!presenceRefs[uid]){
            const ref = db.ref("presence/" + uid);
            presenceRefs[uid] = ref;
            ref.on("value", function(snap){
                const p = snap.val() || {};
                if(currentFriends[uid]) currentFriends[uid].presence = p;
                if(document.getElementById("friendsModal").classList.contains("open")
                   && friendsTab === "friends"){
                    renderFriends();
                }
            });
        }
    });

}


function updateFriendsCounts(){

    const uids = Object.keys(currentFriends || {});
    let online = 0;
    uids.forEach(function(uid){
        const p = (currentFriends[uid] && currentFriends[uid].presence) || {};
        if(p.state === "online") online++;
    });

    const el = document.getElementById("friendsCounts");
    if(el) el.textContent = uids.length + " Friends   •   " + online + " Online";

    updateFriendsBadges();

}


let _badgeReq = 0;
let _badgeInv = 0;

function updateFriendsBadges(){
    if(!currentUser) return;
    const me = currentUser.uid;
    db.ref("friendRequests/" + me).once("value", function(s){
        const reqs = s.val() || {};
        let r = 0;
        for(const k in reqs){
            if(reqs[k] && (!reqs[k].status || reqs[k].status === "pending")) r++;
        }
        const rb = document.getElementById("requestsBadge");
        if(rb){ if(r>0){ rb.textContent=r; rb.style.display="inline-block"; } else rb.style.display="none"; }
        _badgeReq = r;
        applyTotalBadge();
    });
    db.ref("gameInvites/" + me).once("value", function(s){
        const inv = s.val() || {};
        let i = 0;
        for(const k in inv){
            const it = inv[k];
            if(it && it.fromUid !== me && (!it.status || it.status === "pending") && !isExpired(it.timestamp)) i++;
        }
        const ib = document.getElementById("invitesBadge");
        if(ib){ if(i>0){ ib.textContent=i; ib.style.display="inline-block"; } else ib.style.display="none"; }
        _badgeInv = i;
        applyTotalBadge();
    });
}

function applyTotalBadge(){
    const total = (_badgeReq || 0) + (_badgeInv || 0);
    const fb = document.getElementById("friendsBadge");
    const fmb = document.getElementById("friendsModalBadge");
    const disp = total > 0 ? "inline-block" : "none";
    const txt = total > 0 ? String(total) : "";
    if(fb){ fb.textContent = txt; fb.style.display = disp; }
    if(fmb){ fmb.textContent = txt; fmb.style.display = disp; }
}


function showFriendsModal(){
    if(!currentUser){
        showNotification("Please sign in to use Friends.");
        return;
    }
    document.getElementById("friendsModal").classList.add("open");
    setFriendsTab(friendsTab || "friends");
    document.getElementById("friendSearch").value = "";
    document.getElementById("friendSearchResults").innerHTML = "";
}


function closeFriendsModal(){
    document.getElementById("friendsModal").classList.remove("open");
    document.getElementById("friendsContent").innerHTML = "";
}


function setFriendsTab(tab){
    friendsTab = tab;
    const tabs = document.querySelectorAll(".friends-tab");
    tabs.forEach(function(b){
        b.classList.toggle("active", b.getAttribute("data-tab") === tab);
    });
    if(tab === "friends") renderFriends();
    else if(tab === "requests") renderFriendRequests();
    else renderGameInvites();
}


function renderFriends(){
    const content = document.getElementById("friendsContent");
    if(!content) return;
    const uids = Object.keys(currentFriends || {});
    if(!uids.length){
        content.innerHTML = '<div class="empty-note">No friends yet. Search for players above to add friends.</div>';
        return;
    }
    const enriched = uids.map(function(uid){
        const f = currentFriends[uid] || {};
        const presence = f.presence || {};
        return {
            uid: uid,
            name: f.displayName || f.username || "Player",
            username: f.username || "",
            photoURL: f.photoURL || "",
            online: presence.state === "online",
            presence: presence,
            avatarType: f.avatarType || "google",
            avatarId: f.avatarId || ""
        };
    });
    enriched.sort(function(a, b){
        if(a.online !== b.online) return a.online ? -1 : 1;
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
    content.innerHTML = "";
    enriched.forEach(function(f){
        friendRowEl(f).then(function(row){
            content.appendChild(row);
        });
    });
}


async function friendRowEl(f){

    const row = document.createElement("div");
    row.className = "friend-row";
    row.setAttribute("data-uid", f.uid);

    const avatarWrap = document.createElement("div");
    avatarWrap.className = "f-avatar" + (f.online ? "" : " off");
    const avatarInfo = {
        photoURL: f.photoURL || "",
        avatarType: f.avatarType || "google",
        avatarId: f.avatarId || "",
        name: f.name || "?"
    };
    renderUserAvatar(avatarWrap, avatarInfo);

    const main = document.createElement("div");
    main.className = "f-main";
    const name = document.createElement("div");
    name.className = "f-name";
    const dot = document.createElement("span");
    dot.className = "presence-dot " + (f.online ? "on" : "off");
    name.appendChild(dot);
    name.appendChild(document.createTextNode(f.name));
    const sub = document.createElement("div");
    sub.className = "f-sub";
    const at = document.createElement("span");
    at.textContent = "@" + f.username;
    sub.appendChild(at);
    sub.appendChild(document.createElement("br"));
    sub.appendChild(document.createTextNode(
        f.online ? "Online" : ("Last seen " + formatLastSeen(f.presence && f.presence.lastChanged))
    ));
    main.appendChild(name);
    main.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "f-actions";
    const view = document.createElement("button");
    view.className = "f-btn view-friend";
    view.textContent = "View";
    view.addEventListener("click", function(){ showFriendProfile(f.uid); });
    const inv = document.createElement("button");
    inv.className = "f-btn invite";
    inv.textContent = "🎮 Invite";

    if(!f.online){
        inv.disabled = true;
        inv.title = "Friend is offline";
    }
    else if(currentUser){
        const canSend = await canSendInvite(f.uid);
        if(!canSend){
            const active = await getSentActiveInvite(currentUser.uid, f.uid);
            if(active && active.expiresAt){
                const remaining = Math.max(0, Math.ceil((active.expiresAt - Date.now()) / 1000));
                inv.textContent = "⏳ Sent (" + remaining + "s)";
                inv.disabled = true;
            }
            else{
                inv.textContent = "⏳ Sent";
                inv.disabled = true;
            }
        }
    }

    inv.addEventListener("click", function(){ sendGameInvite(f.uid); });
    actions.appendChild(view);
    actions.appendChild(inv);

    row.appendChild(avatarWrap);
    row.appendChild(main);
    row.appendChild(actions);
    return row;
}


function searchPlayers(query){

    const results = document.getElementById("friendSearchResults");
    if(!results) return;
    const q = (query || "").trim().toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, "");
    if(!q || q.length < 3){
        results.innerHTML = '<div class="empty-note">Enter the complete username.</div>';
        return;
    }

    const exactRef = db.ref("usernames/" + q);
    exactRef.once("value", function(snap){
        const data = snap.val();
        if(!data){
            results.innerHTML = '<div class="empty-note">No user found with that username.</div>';
            return;
        }
        const uid = typeof data === "string" ? data : (data.uid || "");
        if(!uid){
            results.innerHTML = '<div class="empty-note">No user found with that username.</div>';
            return;
        }
        db.ref("publicProfiles/" + uid).once("value", function(snap){
            const p = snap.val();
            if(!p || p.uid === currentUser.uid){
                results.innerHTML = '<div class="empty-note">No user found with that username.</div>';
                return;
            }
            results.innerHTML = "";
            results.appendChild(searchResultEl(uid, p));
        });
    });
}


async function searchResultEl(uid, p){

    const row = document.createElement("div");
    row.className = "friend-row";
    const avatarWrap = document.createElement("div");
    avatarWrap.className = "f-avatar";
    const avatarInfo = {
        photoURL: p.photoURL || "",
        avatarType: p.avatarType || "google",
        avatarId: p.avatarId || "",
        name: p.displayName || "Player"
    };
    renderUserAvatar(avatarWrap, avatarInfo);
    const main = document.createElement("div");
    main.className = "f-main";
    const name = document.createElement("div");
    name.className = "f-name";
    name.textContent = p.displayName || "Player";
    const sub = document.createElement("div");
    sub.className = "f-sub";
    sub.textContent = "@" + (p.username || "");
    main.appendChild(name);
    main.appendChild(sub);
    const actions = document.createElement("div");
    actions.className = "f-actions";
    const view = document.createElement("button");
    view.className = "f-btn view-friend";
    view.textContent = "View Profile";
    view.addEventListener("click", function(){ showFriendProfile(uid); });

    const me = currentUser ? currentUser.uid : null;
    if(me && uid === me){
        const you = document.createElement("span");
        you.className = "f-sub";
        you.textContent = "You";
        actions.appendChild(you);
    }
    else if(currentFriends && currentFriends[uid]){
        const already = document.createElement("span");
        already.className = "f-sub";
        already.textContent = "✓ Already Friends";
        actions.appendChild(already);
    }
    else if(me){
        const outSnap = await db.ref("friendRequests/" + uid + "/" + me).once("value");
        const incSnap = await db.ref("friendRequests/" + me + "/" + uid).once("value");
        if(outSnap.exists()){
            const pending = document.createElement("span");
            pending.className = "f-sub";
            pending.textContent = "⏳ Request Sent";
            actions.appendChild(pending);
        }
        else if(incSnap.exists()){
            const acc = document.createElement("button");
            acc.className = "f-btn accept";
            acc.textContent = "👤 Accept Request";
            acc.addEventListener("click", function(){ acceptFriendRequest(uid, incSnap.val()); });
            actions.appendChild(acc);
        }
        else{
            const add = document.createElement("button");
            add.className = "f-btn invite";
            add.textContent = "➕ Add Friend";
            add.addEventListener("click", function(){ sendFriendRequest(uid, p); });
            actions.appendChild(add);
        }
    }

    row.appendChild(avatarWrap);
    row.appendChild(main);
    row.appendChild(actions);
    return row;
}


async function sendFriendRequest(targetUid, targetInfo){
    if(!currentUser || !db) return;
    if(targetUid === currentUser.uid){
        showNotification("You cannot add yourself.");
        return;
    }
    const me = currentUser.uid;

    const fSnap = await db.ref("friends/" + me + "/" + targetUid).once("value");
    if(fSnap.exists()){
        showNotification("✓ Already friends.");
        return;
    }
    const out = await db.ref("friendRequests/" + targetUid + "/" + me).once("value");
    if(out.exists()){
        showNotification("Request already sent.");
        return;
    }
    const inc = await db.ref("friendRequests/" + me + "/" + targetUid).once("value");
    if(inc.exists()){
        showNotification("They already sent you a request. Check Requests tab.");
        return;
    }
    const tSnap = await db.ref("publicProfiles/" + targetUid).once("value");
    if(!tSnap.exists()){
        showNotification("Player not found.");
        return;
    }

    const data = {
        fromUid: me,
        fromUsername: myProfile ? myProfile.username : "",
        fromDisplayName: myProfile ? myProfile.displayName : "",
        fromPhotoURL: myProfile ? myProfile.photoURL : "",
        fromAvatarType: myProfile ? (myProfile.avatarType || "google") : "google",
        fromAvatarId: myProfile ? (myProfile.avatarId || "") : "",
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        status: "pending"
    };
    await db.ref("friendRequests/" + targetUid + "/" + me).set(data);
    showNotification("Friend request sent to " + (targetInfo.displayName || ("@" + targetInfo.username)) + ".");
}


async function acceptFriendRequest(senderUid, req){
    if(!currentUser || !db) return;
    const me = currentUser.uid;
    const ts = firebase.database.ServerValue.TIMESTAMP;

    const updates = {};
    updates["friends/" + me + "/" + senderUid] = {
        uid: senderUid,
        username: req.fromUsername || "",
        displayName: req.fromDisplayName || "",
        photoURL: req.fromPhotoURL || "",
        avatarType: req.fromAvatarType || "google",
        avatarId: req.fromAvatarId || "",
        friendsSince: ts
    };
    updates["friends/" + senderUid + "/" + me] = {
        uid: me,
        username: myProfile ? myProfile.username : "",
        displayName: myProfile ? myProfile.displayName : "",
        photoURL: myProfile ? myProfile.photoURL : "",
        avatarType: myProfile ? (myProfile.avatarType || "google") : "google",
        avatarId: myProfile ? (myProfile.avatarId || "") : "",
        friendsSince: ts
    };
    updates["friendRequests/" + me + "/" + senderUid] = null;

    try{
        await db.ref().update(updates);
        showNotification("✓ You and " + (req.fromDisplayName || "friend") + " are now friends!");
    }
    catch(error){
        console.error(error);
    }
}


async function declineFriendRequest(senderUid){
    if(!currentUser || !db) return;
    await db.ref("friendRequests/" + currentUser.uid + "/" + senderUid).remove();
}


async function removeFriend(friendUid){
    if(!currentUser || !db) return;
    if(!window.confirm("Remove this friend?")) return;
    const updates = {};
    updates["friends/" + currentUser.uid + "/" + friendUid] = null;
    updates["friends/" + friendUid + "/" + currentUser.uid] = null;
    await db.ref().update(updates);
    showNotification("Friend removed.");
}


function renderFriendRequests(){
    const content = document.getElementById("friendsContent");
    if(!content) return;
    const uid = currentUser.uid;
    db.ref("friendRequests/" + uid).once("value", function(s){
        const data = s.val() || {};
        content.innerHTML = "";
        let any = false;
        for(const senderUid in data){
            const r = data[senderUid] || {};
            if(r.status && r.status !== "pending") continue;
            any = true;
            content.appendChild(requestRowEl(senderUid, r));
        }
        if(!any) content.innerHTML = '<div class="empty-note">No pending friend requests.</div>';
    });
}


function requestRowEl(senderUid, r){
    const row = document.createElement("div");
    row.className = "friend-row";
    const avatarWrap = document.createElement("div");
    avatarWrap.className = "f-avatar";
    const avatarInfo = {
        photoURL: r.fromPhotoURL || "",
        avatarType: r.fromAvatarType || "google",
        avatarId: r.fromAvatarId || "",
        name: r.fromDisplayName || "Player"
    };
    renderUserAvatar(avatarWrap, avatarInfo);
    const main = document.createElement("div");
    main.className = "f-main";
    const name = document.createElement("div");
    name.className = "f-name";
    name.textContent = r.fromDisplayName || "Player";
    const sub = document.createElement("div");
    sub.className = "f-sub";
    sub.textContent = "@" + (r.fromUsername || "");
    main.appendChild(name);
    main.appendChild(sub);
    const actions = document.createElement("div");
    actions.className = "f-actions";
    const acc = document.createElement("button");
    acc.className = "f-btn accept";
    acc.textContent = "✓ Accept";
    acc.addEventListener("click", function(){ acceptFriendRequest(senderUid, r); });
    const dec = document.createElement("button");
    dec.className = "f-btn decline";
    dec.textContent = "✕ Decline";
    dec.addEventListener("click", function(){ declineFriendRequest(senderUid); });
    actions.appendChild(acc);
    actions.appendChild(dec);
    row.appendChild(avatarWrap);
    row.appendChild(main);
    row.appendChild(actions);
    return row;
}


function renderGameInvites(){

    const content = document.getElementById("friendsContent");
    if(!content) return;
    const me = currentUser.uid;

    for(const id in inviteCountdownTimers){
        clearInterval(inviteCountdownTimers[id]);
    }
    inviteCountdownTimers = {};

    db.ref("activeGameInvites/" + me).once("value", function(s){
        const data = s.val() || {};
        const invites = Object.keys(data).map(function(key){
            return Object.assign({ inviteId: data[key].inviteId || key }, data[key]);
        });

        content.innerHTML = "";
        let has = false;

        invites.forEach(function(inv){
            if(!inv || !inv.fromUid) return;
            if(inv.status !== "pending") return;
            if(inv.expiresAt && Date.now() > inv.expiresAt) return;
            has = true;
            const isSent = inv.fromUid === me;
            const row = inviteRowEl(inv.inviteId, inv, isSent);
            content.appendChild(row);

            if(inv.expiresAt){
                const timerKey = isSent ? ("sent_" + inv.fromUid) : ("recv_" + inv.fromUid);
                inviteCountdownTimers[timerKey] = setInterval(function(){
                    const remaining = Math.max(0, Math.ceil((inv.expiresAt - Date.now()) / 1000));
                    const sub = row.querySelector(".f-sub");
                    if(sub){
                        if(isSent){
                            sub.textContent = remaining > 0 ? ("⏳ Sent (" + remaining + "s)") : "⌛ Expired";
                        }
                        else{
                            sub.textContent = "Board: " + (inv.boardSize || "?") + " × " + (inv.boardSize || "?") + "  •  Expires in " + remaining + "s";
                        }
                    }
                    if(remaining <= 0){
                        clearInterval(inviteCountdownTimers[timerKey]);
                        delete inviteCountdownTimers[timerKey];
                        if(row.parentNode) row.parentNode.removeChild(row);
                    }
                }, 1000);
            }
        });

        if(!has) content.innerHTML = '<div class="empty-note">No game invitations.</div>';
    });
}


function inviteRowEl(inviteId, inv, isSent){

    const row = document.createElement("div");
    row.className = "friend-row";
    const avatarWrap = document.createElement("div");
    avatarWrap.className = "f-avatar";
    const avatarInfo = {
        photoURL: inv.fromPhotoURL || "",
        avatarType: inv.fromAvatarType || "google",
        avatarId: inv.fromAvatarId || "",
        name: inv.fromDisplayName || "Player"
    };
    renderUserAvatar(avatarWrap, avatarInfo);
    const main = document.createElement("div");
    main.className = "f-main";
    const title = document.createElement("div");
    title.className = "f-name";
    title.textContent = isSent
        ? ("To " + (inv.fromDisplayName || "friend"))
        : ((inv.fromDisplayName || "friend") + " invited you");
    const sub = document.createElement("div");
    sub.className = "f-sub";
    const remaining = inv.expiresAt ? Math.max(0, Math.ceil((inv.expiresAt - Date.now()) / 1000)) : null;
    if(isSent){
        sub.textContent = remaining > 0 ? ("⏳ Sent (" + remaining + "s)") : "⌛ Expired";
    }
    else{
        sub.textContent = "Board: " + (inv.boardSize || "?") + " × " + (inv.boardSize || "?")
            + (remaining !== null ? "  •  Expires in " + remaining + "s" : "");
    }
    main.appendChild(title);
    main.appendChild(sub);
    const actions = document.createElement("div");
    actions.className = "f-actions";

    if(isSent){
        if(inv.status === "accepted"){
            const st = document.createElement("span");
            st.className = "f-sub";
            st.textContent = "✓ Accepted";
            actions.appendChild(st);
        }
        else if(inv.status === "declined"){
            const st = document.createElement("span");
            st.className = "f-sub";
            st.textContent = "❌ Declined";
            actions.appendChild(st);
        }
        else if(inv.expiresAt && Date.now() > inv.expiresAt){
            const st = document.createElement("span");
            st.className = "f-sub";
            st.textContent = "⌛ Expired";
            actions.appendChild(st);
        }
        else{
            const cancel = document.createElement("button");
            cancel.className = "f-btn decline";
            cancel.textContent = "Cancel";
            cancel.addEventListener("click", function(){ cancelGameInvite(inviteId, inv.fromUid); });
            actions.appendChild(cancel);
        }
    }
    else if(inv.expiresAt && Date.now() > inv.expiresAt){
        const exp = document.createElement("span");
        exp.className = "f-sub";
        exp.textContent = "Expired";
        actions.appendChild(exp);
    }
    else{
        const acc = document.createElement("button");
        acc.className = "f-btn accept";
        acc.textContent = "✓ Accept";
        acc.addEventListener("click", function(){ acceptGameInvite(inviteId, inv); });
        const dec = document.createElement("button");
        dec.className = "f-btn decline";
        dec.textContent = "✕ Decline";
        dec.addEventListener("click", function(){ declineGameInvite(inviteId, inv.fromUid); });
        actions.appendChild(acc);
        actions.appendChild(dec);
    }

    row.appendChild(avatarWrap);
    row.appendChild(main);
    row.appendChild(actions);
    return row;
}


function showFriendProfile(uid){
    if(!uid) return;
    db.ref("publicProfiles/" + uid).once("value", function(s){
        const p = s.val();
        if(!p){ showNotification("Profile not found."); return; }
        const photo = document.getElementById("friendPhoto");
        const avatar = { avatarType: p.avatarType || "google", avatarId: p.avatarId || "", photoURL: p.photoURL || "", name: p.displayName || "Player" };
        if(avatar.avatarType === "cartoon" && avatar.avatarId){
            const found = getAvatarById(avatar.avatarId);
            if(found){
                photo.src = found.url;
                photo.style.display = "";
            }
            else if(avatar.photoURL){
                photo.src = avatar.photoURL;
                photo.style.display = "";
            }
            else{
                photo.style.display = "none";
            }
        }
        else if(avatar.photoURL){
            photo.src = avatar.photoURL;
            photo.style.display = "";
        }
        else{
            photo.style.display = "none";
        }
        document.getElementById("friendName").textContent = p.displayName || "";
        document.getElementById("friendUsername").textContent = "@" + (p.username || "");
        const st = p.stats || {};
        const games = st.totalGames || 0;
        const wins = st.wins || 0;
        const rate = games ? Math.round((wins / games) * 100) : 0;
        const box = document.getElementById("friendStats");
        box.innerHTML = "";
        appendStat(box, "Games", games);
        appendStat(box, "Wins", wins);
        appendStat(box, "Win Rate", rate + "%");
        appendStat(box, "Best Streak", st.bestWinStreak || 0);
        activeFriendUid = uid;
        document.getElementById("friendInviteBtn").onclick = function(){ sendGameInvite(uid); };
        document.getElementById("friendRemoveBtn").onclick = function(){ removeFriend(uid); };
        document.getElementById("friendModal").classList.add("open");
    });
}


function appendStat(box, label, value){
    const el = document.createElement("div");
    el.className = "stat-box";
    const v = document.createElement("div");
    v.className = "value good";
    v.textContent = value;
    const l = document.createElement("div");
    l.className = "label";
    l.textContent = label;
    el.appendChild(v);
    el.appendChild(l);
    box.appendChild(el);
}


async function sendGameInvite(friendUid){

    if(!currentUser || !db) return;

    const me = currentUser.uid;

    const pres = await db.ref("presence/" + friendUid).once("value");
    const p = pres.val() || {};
    if(p.state !== "online"){
        showNotification("Friend is offline. Invite when they are online.");
        return;
    }

    const fSnap = await db.ref("friends/" + me + "/" + friendUid).once("value");
    if(!fSnap.exists()){
        showNotification("You can only invite friends.");
        return;
    }

    if(!await canSendInvite(friendUid)){
        const active = await getSentActiveInvite(me, friendUid);
        const remaining = active && active.expiresAt ? Math.max(0, Math.ceil((active.expiresAt - Date.now()) / 1000)) : 20;
        showNotification("⏳ Invite already sent. Wait " + remaining + "s.");
        return;
    }

    let code = roomCode;
    if(!code || !game || game.finished){
        const ok = await createRoomCore(myProfile ? myProfile.displayName : "Player");
        if(!ok) return;
        code = roomCode;
    }

    const inviteId = db.ref("activeGameInvites/" + friendUid).push().key;
    const now = Date.now();
    const data = {
        inviteId: inviteId,
        fromUid: me,
        toUid: friendUid,
        fromUsername: myProfile ? myProfile.username : "",
        fromDisplayName: myProfile ? myProfile.displayName : "",
        fromPhotoURL: myProfile ? myProfile.photoURL : "",
        fromAvatarType: myProfile ? (myProfile.avatarType || "google") : "google",
        fromAvatarId: myProfile ? (myProfile.avatarId || "") : "",
        roomCode: code,
        boardSize: (game && game.size) ? game.size : selectedSize,
        createdAt: now,
        expiresAt: now + INVITE_COOLDOWN_MS,
        status: "pending"
    };

    const updates = {};
    updates["activeGameInvites/" + friendUid + "/" + me] = data;
    updates["activeGameInvites/" + me + "/" + friendUid] = data;
    updates["gameInvites/" + friendUid + "/" + inviteId] = data;
    updates["gameInvites/" + me + "/" + inviteId] = data;

    await db.ref().update(updates);
    showNotification("🎮 Game invitation sent. Waiting for response...");
}


async function acceptGameInvite(inviteId, invite){

    if(!currentUser || !db) return;

    const now = Date.now();
    if(invite.expiresAt && now > invite.expiresAt){
        showNotification("⌛ Invitation expired.");
        await db.ref("activeGameInvites/" + currentUser.uid + "/" + invite.fromUid).remove();
        await db.ref("activeGameInvites/" + invite.fromUid + "/" + currentUser.uid).remove();
        await db.ref("gameInvites/" + currentUser.uid + "/" + inviteId).update({ status: "expired" });
        await db.ref("gameInvites/" + invite.fromUid + "/" + inviteId).remove();
        return;
    }

    const code = invite.roomCode;
    const snap = await db.ref("rooms/" + code).once("value");
    if(!snap.exists()){
        showNotification("❌ Room no longer exists.");
        await db.ref("activeGameInvites/" + currentUser.uid + "/" + invite.fromUid).remove();
        await db.ref("activeGameInvites/" + invite.fromUid + "/" + currentUser.uid).remove();
        return;
    }
    const data = snap.val();
    if(data.players.p2){
        showNotification("❌ Room already full.");
        return;
    }

    const ok = await performJoin(code, myProfile ? myProfile.displayName : (invite.fromUsername || "Player"));
    if(ok){
        const updates = {};
        updates["activeGameInvites/" + currentUser.uid + "/" + invite.fromUid] = null;
        updates["activeGameInvites/" + invite.fromUid + "/" + currentUser.uid] = null;
        updates["gameInvites/" + currentUser.uid + "/" + inviteId] = { status: "accepted" };
        updates["gameInvites/" + invite.fromUid + "/" + inviteId] = null;
        await db.ref().update(updates).catch(function(e){ console.error(e); });
        closeFriendsModal();
        document.getElementById("friendModal").classList.remove("open");
        showNotification("✓ Joined " + (invite.fromDisplayName || "friend") + "'s game!");
    }
}


async function declineGameInvite(inviteId, fromUid){
    if(!currentUser || !db) return;
    const updates = {};
    updates["activeGameInvites/" + currentUser.uid + "/" + fromUid] = null;
    updates["activeGameInvites/" + fromUid + "/" + currentUser.uid] = null;
    updates["gameInvites/" + currentUser.uid + "/" + inviteId] = { status: "declined" };
    updates["gameInvites/" + fromUid + "/" + inviteId] = null;
    await db.ref().update(updates).catch(function(e){ console.error(e); });
    showNotification("Invitation declined.");
}


async function cancelGameInvite(inviteId, fromUid){
    if(!currentUser || !db) return;
    const updates = {};
    updates["activeGameInvites/" + currentUser.uid + "/" + fromUid] = null;
    updates["activeGameInvites/" + fromUid + "/" + currentUser.uid] = null;
    updates["gameInvites/" + currentUser.uid + "/" + inviteId] = { status: "cancelled" };
    updates["gameInvites/" + fromUid + "/" + inviteId] = null;
    await db.ref().update(updates).catch(function(e){ console.error(e); });
    showNotification("Invitation cancelled.");
}


function markInviteStatus(fromUid, inviteId, status){
    const updates = {};
    updates["gameInvites/" + currentUser.uid + "/" + inviteId] = { status: status };
    updates["gameInvites/" + fromUid + "/" + inviteId] = { status: status };
    db.ref().update(updates).catch(function(e){ console.error(e); });
}


function showNotification(text){
    const c = document.getElementById("toasts");
    if(!c) return;
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = text;
    c.appendChild(t);
    setTimeout(function(){
        if(t.parentNode) t.parentNode.removeChild(t);
    }, 4500);
}


function initializeFriends(){
    const openBtn = document.getElementById("openFriends");
    if(openBtn) openBtn.addEventListener("click", showFriendsModal);
    const closeBtn = document.getElementById("closeFriendsBtn");
    if(closeBtn) closeBtn.addEventListener("click", closeFriendsModal);
    const closeFriend = document.getElementById("closeFriendBtn");
    if(closeFriend) closeFriend.addEventListener("click", function(){
        document.getElementById("friendModal").classList.remove("open");
    });
    const fm = document.getElementById("friendsModal");
    if(fm) fm.addEventListener("click", function(e){ if(e.target === this) closeFriendsModal(); });
    const frm = document.getElementById("friendModal");
    if(frm) frm.addEventListener("click", function(e){ if(e.target === this) this.classList.remove("open"); });
    document.querySelectorAll(".friends-tab").forEach(function(b){
        b.addEventListener("click", function(){ setFriendsTab(b.getAttribute("data-tab")); });
    });
    const search = document.getElementById("friendSearch");
    const searchBtn = document.getElementById("friendSearchBtn");
    if(search && searchBtn){
        function doSearch(){
            const now = Date.now();
            if(now - lastFriendSearchTime < FRIEND_SEARCH_COOLDOWN_MS){
                return;
            }
            lastFriendSearchTime = now;
            searchBtn.disabled = true;
            setTimeout(function(){ searchBtn.disabled = false; }, 1000);
            searchPlayers(search.value);
        }
        searchBtn.addEventListener("click", doSearch);
        search.addEventListener("keydown", function(e){
            if(e.key === "Enter"){
                e.preventDefault();
                doSearch();
            }
        });
    }
}

