/* ================= FIREBASE LOAD ================= */

const firebaseScript =
document.createElement("script");

firebaseScript.src =
"https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js";

firebaseScript.onload = () => {

    const databaseScript =
    document.createElement("script");

    databaseScript.src =
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js";

    databaseScript.onload = () => {

        const authScript =
        document.createElement("script");

        authScript.src =
        "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js";

        authScript.onload = () => {

            firebaseLoaded = true;

            initializeFirebase();
            setupAuth();

        };

        document.head.appendChild(authScript);

    };

    document.head.appendChild(databaseScript);

};

document.head.appendChild(firebaseScript);


/* ================= FIREBASE ================= */

let db = null;


function initializeFirebase(){

    const firebaseConfig = {

        apiKey:
        "AIzaSyDBcTvTDmMOMIhmKwx8x57QvGNWWhYlpx8",

        authDomain:
        "dots-and-boxes-60439.firebaseapp.com",

        databaseURL:
        "https://dots-and-boxes-60439-default-rtdb.firebaseio.com",

        projectId:
        "dots-and-boxes-60439",

        storageBucket:
        "dots-and-boxes-60439.firebasestorage.app",

        messagingSenderId:
        "435400230088",

        appId:
        "1:435400230088:web:834195f25c120b698911fd",

        measurementId:
        "G-RLJ2Z0Q8T0"

    };


        firebase.initializeApp(firebaseConfig);

    db = firebase.database();

}

