import { loginUser } from "./auth.js";

document
.getElementById("loginBtn")
.addEventListener("click", async () => {

    const email =
    document.getElementById("email").value;

    const password =
    document.getElementById("password").value;

    const success =
    await loginUser(
        email,
        password
    );

    if(success){

        window.location.href =
        "dashboard.html";

    }

});