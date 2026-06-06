import { auth, db } from "./firebase.js";

import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    doc
}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";


// ======================================
// ADD TASK
// ======================================

export async function addTask(
    taskName,
    startTime,
    endTime
){

    const user =
    auth.currentUser;

    if(!user){
        return;
    }

    await addDoc(

        collection(
            db,
            "users",
            user.uid,
            "tasks"
        ),

        {
            taskName,
            startTime,
            endTime,
            completed:false,
            lastReminderMinute: null,
            createdAt:
            new Date().toISOString()
        }

    );

}


// ======================================
// LOAD TASKS
// ======================================

export async function loadTasks(){

    try {

        const user = auth.currentUser;

        console.log("Current User:", user);

        if(!user){
            console.log("No user found");
            return [];
        }

        console.log("Loading tasks for UID:", user.uid);

        const snapshot = await getDocs(
            collection(
                db,
                "users",
                user.uid,
                "tasks"
            )
        );

        console.log("Documents found:", snapshot.size);

        const tasks = [];

        snapshot.forEach(docItem => {

            console.log(
                "Task Data:",
                docItem.id,
                docItem.data()
            );

            tasks.push({
                id: docItem.id,
                ...docItem.data()
            });

        });

        return tasks;

    } catch(error){

        console.error(
            "LOAD TASK ERROR:",
            error
        );

        return [];
    }

}
// ======================================
// UPDATE TASK
// ======================================

export async function updateTask(
    id,
    taskName,
    startTime,
    endTime
){

    const user =
    auth.currentUser;

    if(!user){
        return;
    }

    await updateDoc(

        doc(
            db,
            "users",
            user.uid,
            "tasks",
            id
        ),

        {
            taskName,
            startTime,
            endTime
        }

    );

}


// ======================================
// COMPLETE TASK
// ======================================

export async function completeTask(id){

    const user =
    auth.currentUser;

    if(!user){
        return;
    }

    await updateDoc(

        doc(
            db,
            "users",
            user.uid,
            "tasks",
            id
        ),

        {
            completed:true
        }

    );

}


// ======================================
// INCOMPLETE TASK
// ======================================

export async function incompleteTask(id){

    const user =
    auth.currentUser;

    if(!user){
        return;
    }

    await updateDoc(

        doc(
            db,
            "users",
            user.uid,
            "tasks",
            id
        ),

        {
            completed:false
        }

    );

}


// ======================================
// DELETE TASK
// ======================================

export async function deleteTask(id){

    const user =
    auth.currentUser;

    if(!user){
        return;
    }

    await deleteDoc(

        doc(
            db,
            "users",
            user.uid,
            "tasks",
            id
        )

    );

}