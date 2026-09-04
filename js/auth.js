
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


function validateUsername(username){

    username = (username || "").trim();

    if(username.length < 3 || username.length > 20){
        return "Username must be 3-20 characters.";
    }

    if(!/^[a-z0-9_]+$/.test(username)){
        return "Only letters, numbers and underscore allowed.";
    }

    return "";

}


async function saveProfile(){

    if(!currentUser) return;

    const newUsername = (document.getElementById("editUsername").value || "").trim();
    const newName = (document.getElementById("editDisplayName").value || "").trim();
    const newBio = (document.getElementById("editBio").value || "").trim();

    const err = validateUsername(newUsername);
    if(err){
        document.getElementById("modalError").textContent = err;
        return;
    }

    if(!newName){
        document.getElementById("modalError").textContent = "Display name cannot be empty.";
        return;
    }

    if(await isUsernameTaken(newUsername, currentUser.uid)){
        document.getElementById("modalError").textContent = "Username already taken.";
        return;
    }

    const updates = {
        username: newUsername,
        displayName: newName,
        bio: newBio
    };

    const previousUsername = myProfile.username;

    try{
        await db.ref("players/" + currentUser.uid).update(updates);
        Object.assign(myProfile, updates);
        syncPublicProfile(previousUsername);
        document.getElementById("modalError").textContent = "";
        showProfileModal();
    }
    catch(error){
        console.error(error);
        document.getElementById("modalError").textContent = "❌ Save failed.";
    }

}


function loadProfile(){
    return myProfile;
}


async function updateStats(uid, result, boxes){

    const ref = db.ref("players/" + uid + "/stats");

    await ref.transaction(function(s){

        s = s || {
            totalGames: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            totalBoxes: 0,
            currentWinStreak: 0,
            bestWinStreak: 0
        };

        s.totalGames = (s.totalGames || 0) + 1;
        s.totalBoxes = (s.totalBoxes || 0) + (boxes || 0);

        if(result === "win"){
            s.wins = (s.wins || 0) + 1;
            s.currentWinStreak = (s.currentWinStreak || 0) + 1;
            s.bestWinStreak = Math.max((s.bestWinStreak || 0), s.currentWinStreak);
        }
        else if(result === "loss"){
            s.losses = (s.losses || 0) + 1;
            s.currentWinStreak = 0;
        }
        else{
            s.draws = (s.draws || 0) + 1;
            s.currentWinStreak = 0;
        }

        return s;

    });

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


function buildPlayerObject(nameFallback){

    if(currentUser && myProfile){
        return {
            uid: currentUser.uid,
            name: myProfile.displayName,
            username: myProfile.username,
            photoURL: myProfile.photoURL,
            avatarType: myProfile.avatarType || "google",
            avatarId: myProfile.avatarId || ""
        };
    }

    return { name: nameFallback };

}


/* ================= PROFILE UI ================= */

function renderAuthState(){

    const signedOut = document.getElementById("authSignedOut");
    const signedIn = document.getElementById("authSignedIn");

    if(currentUser && myProfile){

        signedOut.style.display = "none";
        signedIn.style.display = "flex";

        const avatarEl = document.getElementById("authAvatar");
        renderUserAvatar(avatarEl, { photoURL: myProfile.photoURL, name: myProfile.displayName });

        document.getElementById("authName").textContent =
            myProfile.displayName || currentUser.displayName || "Player";

        document.getElementById("authUsername").textContent =
            "@" + (myProfile.username || "");

    }
    else{
        signedOut.style.display = "block";
        signedIn.style.display = "none";
    }

}


function renderUserProfile(){
    renderAuthState();
}


function showProfileModal(){

    if(!currentUser || !myProfile){
        return;
    }

    const p = myProfile;

    const photo = document.getElementById("modalPhoto");
    const avatar = getUserAvatar();
    if(avatar.avatarType === "cartoon" && avatar.avatarId){
        const found = getAvatarById(avatar.avatarId);
        if(found){
            photo.src = found.url;
            photo.style.display = "";
        }
        else{
            photo.style.display = "none";
        }
    }
    else if(p.photoURL){
        photo.src = p.photoURL;
        photo.style.display = "";
    }
    else{
        photo.style.display = "none";
    }

    document.getElementById("modalName").textContent = p.displayName || "";
    document.getElementById("modalUsername").textContent = "@" + (p.username || "");

    const s = p.stats || {};
    const games = s.totalGames || 0;
    const wins = s.wins || 0;
    const losses = s.losses || 0;
    const draws = s.draws || 0;
    const rate = games ? Math.round((wins / games) * 100) : 0;

    document.getElementById("statGames").textContent = games;
    document.getElementById("statWins").textContent = wins;
    document.getElementById("statLosses").textContent = losses;
    document.getElementById("statDraws").textContent = draws;
    document.getElementById("statRate").textContent = rate + "%";
    document.getElementById("statBoxes").textContent = s.totalBoxes || 0;
    document.getElementById("statStreak").textContent = s.currentWinStreak || 0;
    document.getElementById("statBest").textContent = s.bestWinStreak || 0;

    document.getElementById("editUsername").value = p.username || "";
    document.getElementById("editDisplayName").value = p.displayName || "";
    document.getElementById("editBio").value = p.bio || "";

    document.getElementById("editFields").style.display = "none";
    document.getElementById("modalError").textContent = "";

    const editBtn = document.getElementById("editProfileBtn");
    if(editBtn) editBtn.textContent = "✏️ Edit Profile";

    document.getElementById("profileModal").classList.add("open");

}


function closeProfileModal(){
    document.getElementById("profileModal").classList.remove("open");
    document.getElementById("editFields").style.display = "none";
}

