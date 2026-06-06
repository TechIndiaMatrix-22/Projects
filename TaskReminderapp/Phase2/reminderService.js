const { admin, db } = require("./firebaseAdmin");

async function checkReminders() {

    try {

        console.log("\n====================================");
        console.log("Checking Reminders...");
        console.log("====================================");

        const usersSnapshot =
            await db.collection("users").get();

        const now = new Date();

        for (const userDoc of usersSnapshot.docs) {

            const userData = userDoc.data();

            const fcmToken =
                userData.fcmToken;

            if (!fcmToken) {

                console.log(
                    `❌ No FCM Token for User: ${userDoc.id}`
                );

                continue;
            }

            const tasksSnapshot =
                await db
                    .collection("users")
                    .doc(userDoc.id)
                    .collection("tasks")
                    .get();

            console.log(
                `\n👤 User: ${userDoc.id}`
            );

            console.log(
                `📋 Tasks Found: ${tasksSnapshot.size}`
            );

            for (const taskDoc of tasksSnapshot.docs) {

                const task =
                    taskDoc.data();

                if (task.completed)
                    continue;

                const deadline =
                    new Date(task.endTime);

                const diffMinutes =
                    (deadline - now) /
                    (1000 * 60);

                const remainingMinutes =
                    Math.ceil(diffMinutes);

                console.log(
                    `📌 ${task.taskName} | ${remainingMinutes} minute(s) left`
                );

                // Countdown from 10 to 1 minute

                if (
                    remainingMinutes > 0 &&
                    remainingMinutes <= 10
                ) {

                    if (
                        task.lastReminderMinute ===
                        remainingMinutes
                    ) {

                        continue;
                    }

                    try {

                        console.log(
                            `🔔 Sending ${remainingMinutes} minute reminder`
                        );

                        const response =
                            await admin
                                .messaging()
                                .send({

                                    token:
                                        fcmToken,

                                    notification: {
                                        title:
                                            "🔔 Task Reminder",

                                        body:
                                            `${task.taskName} - ${remainingMinutes} minute(s) left`
                                    }

                                });

                        console.log(
                            `✅ Notification Sent`
                        );

                        console.log(
                            `📨 ${response}`
                        );

                        await taskDoc.ref.update({

                            lastReminderMinute:
                                remainingMinutes

                        });

                    } catch (fcmError) {

                        console.error(
                            "❌ FCM Error:"
                        );

                        console.error(
                            fcmError
                        );
                    }
                }
            }
        }

        console.log(
            "\n===================================="
        );

    } catch (error) {

        console.error(
            "❌ Reminder Service Error:"
        );

        console.error(error);
    }
}

module.exports = {
    checkReminders
};