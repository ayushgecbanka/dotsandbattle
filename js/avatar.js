/* ================= AVATARS ================= */

const AVATARS = {
    boys: [
        { id: "boy_01", name: "Classic Boy", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=boy1&backgroundColor=b6e3f4" },
        { id: "boy_02", name: "Cool Boy", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=boy2&backgroundColor=c0aede" },
        { id: "boy_03", name: "Sporty Boy", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=boy3&backgroundColor=ffdfbf" },
        { id: "boy_04", name: "Gamer Boy", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=boy4&backgroundColor=d1f4e0" },
        { id: "boy_05", name: "Hipster Boy", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=boy5&backgroundColor=ffd5dc" },
        { id: "boy_06", name: "Young Explorer", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=boy6&backgroundColor=e5e5e5" },
        { id: "boy_07", name: "Street Style", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=boy7&backgroundColor=ffe8b6" },
        { id: "boy_08", name: "Casual Boy", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=boy8&backgroundColor=ffdfbf" },
        { id: "boy_09", name: "Urban Boy", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=boy9&backgroundColor=c0aede" },
        { id: "boy_10", name: "Neon Boy", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=boy10&backgroundColor=b6e3f4" },
        { id: "boy_11", name: "Retro Boy", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=boy11&backgroundColor=d1f4e0" },
        { id: "boy_12", name: "Summer Boy", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=boy12&backgroundColor=ffd5dc" }
    ],
    girls: [
        { id: "girl_01", name: "Classic Girl", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=girl1&backgroundColor=ffdfbf" },
        { id: "girl_02", name: "Cool Girl", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=girl2&backgroundColor=b6e3f4" },
        { id: "girl_03", name: "Sporty Girl", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=girl3&backgroundColor=c0aede" },
        { id: "girl_04", name: "Gamer Girl", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=girl4&backgroundColor=d1f4e0" },
        { id: "girl_05", name: "Hipster Girl", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=girl5&backgroundColor=ffe8b6" },
        { id: "girl_06", name: "Young Explorer", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=girl6&backgroundColor=e5e5e5" },
        { id: "girl_07", name: "Street Style", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=girl7&backgroundColor=ffd5dc" },
        { id: "girl_08", name: "Casual Girl", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=girl8&backgroundColor=ffdfbf" },
        { id: "girl_09", name: "Urban Girl", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=girl9&backgroundColor=b6e3f4" },
        { id: "girl_10", name: "Neon Girl", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=girl10&backgroundColor=c0aede" },
        { id: "girl_11", name: "Retro Girl", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=girl11&backgroundColor=d1f4e0" },
        { id: "girl_12", name: "Summer Girl", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=girl12&backgroundColor=ffe8b6" }
    ]
};


/* ================= AVATAR SYSTEM ================= */

function getUserAvatar(){
    if(!myProfile) return { avatarType: "google", photoURL: "", avatarId: "" };
    return {
        avatarType: myProfile.avatarType || "google",
        photoURL: myProfile.photoURL || "",
        avatarId: myProfile.avatarId || ""
    };
}


function getAvatarById(id){
    const all = [].concat(AVATARS.boys || [], AVATARS.girls || []);
    return all.find(a => a.id === id) || null;
}


function renderUserAvatar(wrapEl, user){
    if(!wrapEl) return;
    while(wrapEl.firstChild) wrapEl.removeChild(wrapEl.firstChild);

    const avatar = getUserAvatar();
    let src = "";

    if(avatar.avatarType === "cartoon" && avatar.avatarId){
        const found = getAvatarById(avatar.avatarId);
        if(found) src = found.url;
    }

    if(!src && user && user.photoURL) src = user.photoURL;
    if(!src && myProfile && myProfile.photoURL) src = myProfile.photoURL;

    if(src){
        const img = document.createElement("img");
        img.src = src;
        img.className = "avatar";
        img.alt = "";
        wrapEl.appendChild(img);
    }
    else{
        const span = document.createElement("span");
        span.className = "avatar-fallback";
        const name = (user && user.name) ? user.name : (myProfile && myProfile.displayName) ? myProfile.displayName : "?";
        span.textContent = name.charAt(0).toUpperCase();
        wrapEl.appendChild(span);
    }
}


function openAvatarPicker(){
    if(!currentUser || !myProfile) return;

    const avatar = getUserAvatar();
    selectedAvatarId = avatar.avatarId || null;
    selectedAvatarCategory = "boys";

    document.getElementById("avatarPickerModal").classList.add("open");
    renderAvatarPicker();
    updateAvatarPreview();
}


function closeAvatarPicker(){
    document.getElementById("avatarPickerModal").classList.remove("open");
}


function renderAvatarPicker(){
    const container = document.getElementById("avatarOptions");
    if(!container) return;
    container.innerHTML = "";

    const list = AVATARS[selectedAvatarCategory] || [];

    list.forEach(item => {
        const card = document.createElement("div");
        card.className = "avatar-card" + (selectedAvatarId === item.id ? " selected" : "");
        card.innerHTML = `<img src="${item.url}" alt="${item.name}" loading="lazy"><div class="avatar-check">✓</div><div class="avatar-name">${item.name}</div>`;
        card.addEventListener("click", function(){
            selectedAvatarId = item.id;
            document.querySelectorAll(".avatar-card").forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");
            updateAvatarPreview();
        });
        container.appendChild(card);
    });
}


function updateAvatarPreview(){
    const img = document.getElementById("avatarPreviewImage");
    const fallback = document.getElementById("avatarPreviewFallback");
    const nameEl = document.getElementById("avatarPreviewName");
    if(!img || !fallback || !nameEl) return;

    const found = getAvatarById(selectedAvatarId);
    if(found){
        img.src = found.url;
        img.style.display = "";
        fallback.style.display = "none";
    }
    else{
        img.style.display = "none";
        fallback.style.display = "";
    }
    nameEl.textContent = found ? found.name : (myProfile && myProfile.displayName ? myProfile.displayName : "");
}


async function saveSelectedAvatar(){
    if(!currentUser || !myProfile) return;

    const updates = {
        avatarType: selectedAvatarId ? "cartoon" : "google",
        avatarId: selectedAvatarId || ""
    };

    try{
        await db.ref("players/" + currentUser.uid).update(updates);
        Object.assign(myProfile, updates);
        closeAvatarPicker();
        showProfileModal();
        renderAuthState();
    }
    catch(error){
        console.error(error);
    }
}


/* ================= EVENT LISTENERS ================= */

document.getElementById("googleSignIn")
.addEventListener("click", signInWithGoogle);

document.getElementById("viewProfile")
.addEventListener("click", showProfileModal);

document.getElementById("closeModalBtn")
.addEventListener("click", closeProfileModal);

document.getElementById("signOutBtn")
.addEventListener("click", signOutUser);

document.getElementById("editProfileBtn")
.addEventListener("click", function(){
    const fields = document.getElementById("editFields");
    if(fields.style.display === "none"){
        toggleEditMode();
    }
    else{
        saveProfile();
    }
});

document.getElementById("profileModal")
.addEventListener("click", function(e){
    if(e.target === this){
        closeProfileModal();
    }
});

document.getElementById("avatarTabBoys")
.addEventListener("click", function(){
    selectedAvatarCategory = "boys";
    document.querySelectorAll(".avatar-tab").forEach(t => t.classList.remove("active"));
    this.classList.add("active");
    renderAvatarPicker();
});

document.getElementById("avatarTabGirls")
.addEventListener("click", function(){
    selectedAvatarCategory = "girls";
    document.querySelectorAll(".avatar-tab").forEach(t => t.classList.remove("active"));
    this.classList.add("active");
    renderAvatarPicker();
});

document.getElementById("saveAvatarBtn")
.addEventListener("click", saveSelectedAvatar);

document.getElementById("closeAvatarBtn")
.addEventListener("click", closeAvatarPicker);

document.getElementById("avatarPickerModal")
.addEventListener("click", function(e){
    if(e.target === this){
        closeAvatarPicker();
    }
});

document.getElementById("changeAvatarBtn")
.addEventListener("click", openAvatarPicker);

