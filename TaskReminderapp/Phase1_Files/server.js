const express = require("express");
const path = require("path");
const os = require("os");

const app = express();

app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.redirect("/register");
});

app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, "register.html"));
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/dashboard", (req, res) => {
    res.sendFile(path.join(__dirname, "dashboard.html"));
});

app.listen(8000, "0.0.0.0", () => {
     const interfaces = os.networkInterfaces();

    console.log("\n====================================");

    console.log("Server Running");

    for (const name of Object.keys(interfaces)) {

        for (const net of interfaces[name]) {

            if (
                net.family === "IPv4" &&
                !net.internal
            ) {

                console.log(
                    `Local Network: http://${net.address}:8000`
                );

            }
        }
    }
});