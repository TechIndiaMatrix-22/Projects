const express = require("express");
const path = require("path");
const os = require("os");

const cron = require("node-cron");
const {
    checkReminders
} = require("./reminderService");

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

cron.schedule("* * * * *", async () => {

    console.log("Running reminder check...");

    await checkReminders();

});


app.listen(8000, "0.0.0.0", () => {

    const interfaces = os.networkInterfaces();

    console.log("\n====================================");

    console.log("Server Running");

    console.log(
        "Localhost: http://localhost:8000"
    );

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

    console.log(
        "====================================\n"
    );

});