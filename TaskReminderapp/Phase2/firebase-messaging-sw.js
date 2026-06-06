importScripts(
  "https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyB6BiLURxFdBGv4AI-axduktADai-mOKuE",
  authDomain: "test-58cfc.firebaseapp.com",
  projectId: "test-58cfc",
  storageBucket: "test-58cfc.firebasestorage.app",
  messagingSenderId: "57409400859",
  appId: "1:57409400859:web:55a16f121825a30be148be"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {

    console.log("Background message received");

});