import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB6BiLURxFdBGv4AI-axduktADai-mOKuE",
  authDomain: "test-58cfc.firebaseapp.com",
  projectId: "test-58cfc",
  storageBucket: "test-58cfc.firebasestorage.app",
  messagingSenderId: "57409400859",
  appId: "1:57409400859:web:55a16f121825a30be148be",
  measurementId: "G-TR4502M6B9"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);