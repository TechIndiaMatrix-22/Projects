import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged
}
from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

import { logoutUser } from "./auth.js";

import { registerFCM } from "./notifications.js";

import {
  addTask,
  loadTasks,
  updateTask,
  deleteTask,
  completeTask,
  incompleteTask
}
from "./tasks.js";


import {
    doc,
    getDoc
}
from
"https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";



const taskList =
document.getElementById("taskList");

const userInfo =
document.getElementById("userInfo");

document
.getElementById("logoutBtn")
.addEventListener("click", async()=>{

    await logoutUser();

    window.location.href =
    "login.html";

});

document
.getElementById("addTaskBtn")
.addEventListener("click", async()=>{

    const taskName =
    document.getElementById("taskName").value;

    const startTime =
    document.getElementById("startTime").value;

    const endTime =
    document.getElementById("endTime").value;

    if(
        !taskName ||
        !startTime ||
        !endTime
    )
    {
        alert("Please fill all fields");
        return;
    }

    await addTask(
      taskName,
      startTime,
      endTime
    );

    document.getElementById("taskName").value="";
    document.getElementById("startTime").value="";
    document.getElementById("endTime").value="";

    renderTasks();

});

onAuthStateChanged(auth, async(user)=>{

    if(!user){

        window.location.href =
        "login.html";

        return;
    }
    console.log("Current UID:", user.uid);
    /*userInfo.innerHTML =
    `Logged in as: ${user.email}`;*/

    await loadUserInfo(user);
    
    await registerFCM(); 

    renderTasks();

});

async function loadUserInfo(user){

    console.log("Current User UID:", user.uid);

    const docRef =
    doc(db, "users", user.uid);

    const docSnap =
    await getDoc(docRef);

    console.log("Document Exists:", docSnap.exists());

    if(docSnap.exists()){

        const userData =
        docSnap.data();

        console.log("User Data:", userData);
        console.log("Name:", userData.name);

        console.log(userData);

        userInfo.innerHTML = `
            <div class="profile-card">

                <h2 class="profile-name">
                    ${userData.name}
                </h2>

                <p class="profile-email">
                    📧 ${userData.email}
                </p>

                <p class="profile-phone">
                    📱 ${userData.phone}
                </p>

            </div>
        `;
    }
    else{

        console.log("No user document found");

    }
}


async function renderTasks(){

    const tasks = await loadTasks();
    console.log("Tasks Loaded:", tasks);

    taskList.innerHTML = "";

    tasks.forEach(task => {

        const card =
        document.createElement("div");

        card.className =
        task.completed
        ? "task-card completed"
        : "task-card";

        card.innerHTML = `

            <h3>${task.taskName}</h3>

            <div class="task-time-info">

                <p class="task-date">
                    📅 ${formatDate(task.startTime)}
                </p>

                <p class="start-time">
                    🟢 Start:
                    ${formatTime(task.startTime)}
                </p>

                <p class="end-time">
                    🔴 End:
                    ${formatTime(task.endTime)}
                </p>

            </div>

            <input
                id="name-${task.id}"
                class="edit-input"
                value="${task.taskName}"
            >

            <input
                id="start-${task.id}"
                class="edit-input"
                type="datetime-local"
                value="${task.startTime}"
            >

            <input
                id="end-${task.id}"
                class="edit-input"
                type="datetime-local"
                value="${task.endTime}"
            >

            <div class="task-buttons">

                <button
                    class="update-btn"
                    data-id="${task.id}">
                    Update
                </button>

                <button
                    class="delete-btn"
                    data-id="${task.id}">
                    Delete
                </button>

                ${
                    task.completed
                    ?
                    `
                    <button
                        class="incomplete-btn"
                        data-id="${task.id}">
                        Incomplete
                    </button>
                    `
                    :
                    `
                    <button
                        class="complete-btn"
                        data-id="${task.id}">
                        Complete
                    </button>
                    `
                }

            </div>

        `;

        taskList.appendChild(card);

    });

    attachEvents();
}

function attachEvents(){

    document
    .querySelectorAll(".update-btn")
    .forEach(btn=>{

        btn.addEventListener(
        "click",
        async()=>{

            const id =
            btn.dataset.id;

            await updateTask(
              id,
              document.getElementById(`name-${id}`).value,
              document.getElementById(`start-${id}`).value,
              document.getElementById(`end-${id}`).value
            );

            renderTasks();

        });

    });

    document
    .querySelectorAll(".delete-btn")
    .forEach(btn=>{

        btn.addEventListener(
        "click",
        async()=>{

            await deleteTask(
                btn.dataset.id
            );

            renderTasks();

        });

    });

    document
    .querySelectorAll(".complete-btn")
    .forEach(btn=>{

        btn.addEventListener(
        "click",
        async()=>{

            await completeTask(
                btn.dataset.id
            );

            renderTasks();

        });

    });

    document
    .querySelectorAll(".incomplete-btn")
    .forEach(btn=>{

        btn.addEventListener(
        "click",
        async()=>{

            await incompleteTask(
                btn.dataset.id
            );

            renderTasks();

        });

    });
}

function formatDate(dateString){

    const date =
    new Date(dateString);

    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}

function formatTime(dateString){

    const date =
    new Date(dateString);

    return date.toLocaleTimeString(
        "en-IN",
        {
            hour: "numeric",
            minute: "2-digit",
            hour12: true
        }
    );
}