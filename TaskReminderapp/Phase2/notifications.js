import { messaging, auth, db } from "./firebase.js";

import {
  getToken
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging.js";

import {
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

export async function registerFCM() {
    console.log("registerFCM called");

    if (!messaging) {
        console.log("FCM not available");
        return;
    }

    const permission =
        await Notification.requestPermission();

    if (permission !== "granted") {
        console.log("Permission denied");
        return;
    }

    const token = await getToken(
        messaging,
        {
            vapidKey:
            "BMaUgxJhr1UcnW1nHe_nWTSimC2GIlMdKdt1UZb0yalWz_5GUTEimdW0UNxKeAFSXWbogEI9wrqc44kpe-xKE8Q"
        }
    );

    console.log("FCM TOKEN:", token);

    const user = auth.currentUser;

    if (!user) return;

    await updateDoc(
        doc(db, "users", user.uid),
        {
            fcmToken: token
        }
    );

    console.log("FCM token saved");
}