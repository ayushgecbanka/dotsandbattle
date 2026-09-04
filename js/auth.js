
/* ================= AUTHENTICATION ================= */

function setStatus(msg){
    const el = document.getElementById("status");
    if(el) el.textContent = msg;
}


/* ================= GOOGLE SIGN-IN ================= */

function signInWithGoogle(){

    if(!firebaseLoaded || !firebase.auth){
        setStatus("⏳ Firebase loading... please wait.");
        return;
    }

    const provider = new firebase.auth.GoogleAuthProvider();

    firebase.auth().signInWithPopup(provider)
        .then(() => {
            /* handled by onAuthStateChanged */
        })
        .catch(error => {
            console.error(error);
            setStatus("❌ Google sign-in failed: " + error.message);
        });

}


/* ================= SIGN OUT ================= */

function signOutUser(){

    if(!firebase.auth) return;

    firebase.auth().signOut()
        .then(() => {
            currentUser = null;
            myProfile = null;
            stopPresence();
            cleanupFriendsListeners();
            renderAuthState();
            closeProfileModal();
            closeFriendsModal();
        })
        .catch(error => {
            console.error(error);
        });

}


/* ================= AUTH STATE ================= */

function setupAuth(){
    firebase.auth().onAuthStateChanged(handleAuthState);
}


async function handleAuthState(user){

    currentUser = user || null;

    if(user){
        await createOrLoadProfile(user);
        initializePresence();
        initializeFriendsListeners();
    }
    else{
        stopPresence();
        cleanupFriendsListeners();
    }

    renderAuthState();

}


/* ================= USER PROFILE ================= */

async function createOrLoadProfile(user){

    const ref = db.ref("players/" + user.uid);

    try{
        const snapshot = await ref.once("value");

        if(!snapshot.exists()){
            const profile = buildNewProfile(user);
            await ref.set(profile);
            myProfile = profile;
        }
        else{
            const existing = snapshot.val();
            const updates = {
                displayName: user.displayName || existing.displayName || "Player",
                photoURL: user.photoURL || existing.photoURL || "",
                email: user.email || existing.email || "",
                lastLogin: Date.now()
            };
            if(!existing.avatarType) updates.avatarType = "google";
            if(!existing.avatarId) updates.avatarId = "";
            await ref.update(updates);
            myProfile = Object.assign({}, existing, updates);
        }

        renderAuthState();
        syncPublicProfile();
    }
    catch(error){
        console.error(error);
    }

}


function syncPublicProfile(oldUsername){

    if(!currentUser || !myProfile || !db) return;

    const newUname = (myProfile.username || "").toLowerCase();

    const pub = {
        uid: currentUser.uid,
        username: myProfile.username || "",
        displayName: myProfile.displayName || "",
        photoURL: myProfile.photoURL || "",
        avatarType: myProfile.avatarType || "google",
        avatarId: myProfile.avatarId || "",
        stats: myProfile.stats || {}
    };

    const updates = {};
    updates["publicProfiles/" + currentUser.uid] = pub;
    if(newUname) updates["usernames/" + newUname] = currentUser.uid;
    if(oldUsername && oldUsername.toLowerCase() !== newUname){
        updates["usernames/" + oldUsername.toLowerCase()] = null;
    }

    db.ref().update(updates).catch(function(e){ console.error(e); });

}


function buildNewProfile(user){

    const displayName = user.displayName || "Player";
    const baseUsername = generateUsername(displayName);

    return {
        uid: user.uid,
        displayName: displayName,
        username: baseUsername,
        photoURL: user.photoURL || "",
        email: user.email || "",
        bio: "",
        createdAt: Date.now(),
        lastLogin: Date.now(),
        avatarType: "google",
        avatarId: "",
        stats: {
            totalGames: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            totalBoxes: 0,
            currentWinStreak: 0,
            bestWinStreak: 0
        }
    };

}


function generateUsername(displayName){

    let base = (displayName || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "")
        .substring(0, 20);

    if(base.length < 3){
        base = (base + "player").substring(0, 20);
    }

    return base;

}


/* ================= PROFILE FIREBASE ================= */

async function isUsernameTaken(username, exceptUid){

    const snapshot = await db.ref("players").once("value");
    const data = snapshot.val() || {};

    for(const uid in data){
        if(exceptUid && uid === exceptUid) continue;
        const p = data[uid];
        if(p && p.username &&
           p.username.toLowerCase() === username.toLowerCase()){
            return true;
        }
    }

    return false;

}


/* ================= PLAYER INFO HELPERS ================= */

function getPlayerInfo(slot){

    const p = game && game.players ? game.players[slot] : null;

    if(!p) return { name: "", username: "", photoURL: "", uid: "", avatarType: "", avatarId: "" };

    if(typeof p === "string") return { name: p, username: "", photoURL: "", uid: "", avatarType: "", avatarId: "" };

    return {
        name: p.name || "",
        username: p.username || "",
        photoURL: p.photoURL || "",
        uid: p.uid || "",
        avatarType: p.avatarType || "",
        avatarId: p.avatarId || ""
    };

}

