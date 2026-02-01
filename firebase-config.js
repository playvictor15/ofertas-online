
// firebase-config.js (CORRIGIDO)

// Note que agora usamos URLs completas terminando em .js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDeVcB0fS3ae8A7DiTZa5dd8iQ-btHcHMM",
  authDomain: "central-de-ofertas-6c475.firebaseapp.com",
  projectId: "central-de-ofertas-6c475",
  storageBucket: "central-de-ofertas-6c475.firebasestorage.app",
  messagingSenderId: "239733975406",
  appId: "1:239733975406:web:c361eb3018f843a62c797f",
  measurementId: "G-9XVZZYV3EK"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
