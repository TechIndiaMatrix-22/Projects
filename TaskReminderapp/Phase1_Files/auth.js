import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import {
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

export async function registerUser(name,email, password, phone) {

  try {

    const credential =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    const user = credential.user;

    await setDoc(
      doc(db, "users", user.uid),
      {
        uid: user.uid,
        name: name,
        email: email,
        phone: phone,
        createdAt: new Date().toISOString()
      }
    );

    return true;

  } catch (error) {

    alert(error.message);
    return false;
  }
}

export async function loginUser(email, password) {

  try {

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    return true;

  } catch (error) {

    alert(error.message);
    return false;
  }
}

export async function logoutUser() {
  await signOut(auth);
}