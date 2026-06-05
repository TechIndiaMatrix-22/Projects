import { registerUser } from "./auth.js";

document
.getElementById("registerBtn")
.addEventListener("click", async () => {

    const name =
    document.getElementById("name").value.trim();

    const email =
    document.getElementById("email").value.trim();

    const password =
    document.getElementById("password").value;

    const phone =
    document.getElementById("phone").value.trim();


    if(!name ||!email || !password || !phone ){
        alert("Fill all fields");
        return;
    }

    const success =
    await registerUser(
        name,
        email,
        password,
        phone
    );

    if(success){

        alert("Registration Successful");

        window.location.href =
        "login.html";
    }

});