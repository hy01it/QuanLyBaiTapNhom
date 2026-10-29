import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCKHINEBrwK2U_tXHHC5Q0qBtRdAMQ3hBY",
    authDomain: "quanlybaitapnhom-7de3d.firebaseapp.com",
    projectId: "quanlybaitapnhom-7de3d",
    storageBucket: "quanlybaitapnhom-7de3d.firebasestorage.app",
    messagingSenderId: "493891248738",
    appId: "1:493891248738:web:5ce9da4cdfae35a8c5a73b",
    measurementId: "G-5M7XZEBSYR"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
