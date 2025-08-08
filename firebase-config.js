// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC140uOrSnef_0bCBqhmXATwxuW6FxiZGU",
  authDomain: "rodovias-vistoriadas.firebaseapp.com",
  projectId: "rodovias-vistoriadas",
  storageBucket: "rodovias-vistoriadas.firebasestorage.app",
  messagingSenderId: "451299894943",
  appId: "1:451299894943:web:b8d61612132d9c1b1c64aa",
  measurementId: "G-78DCMFL158"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };