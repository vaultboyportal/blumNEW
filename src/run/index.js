import colors from "colors";
import dayjs from "dayjs";
import datetimeHelper from "../helpers/datetime.js";
import delayHelper from "../helpers/delay.js";
import fileHelper from "../helpers/file.js";
import authService from "../services/auth.js";
import dailyService from "../services/daily.js";
import farmingClass from "../services/farming.js";
import gameService from "../services/game.js";
import inviteClass from "../services/invite.js";
import server from "../services/server.js";
import taskService from "../services/task.js";
import tribeService from "../services/tribe.js";
import userService from "../services/user.js";
import axios from "axios"; // Import axios for HTTP requests

const VERSION = "v0.1.7";

// Hidden banner text encoded in Base64 (GN SCRIPT ZONE)
const encodedBanner = "R04gU0NSSVBUIFpPTkU=";
const authorText = "QXV0aG9yIC0gTmFpbUdhemlUIFRHIEBCTFVNU0NSSVBUUyBUZWxlZ3JhbSAtIGh0dHBzOi8vdC5tZS9HTlNDUklQVFpPTkUKWW91dHViZSAtIGh0dHBzOi8vd3d3LnlvdXR1YmUuY29tL0BHeWFhbmlOYWlt"; // Base64 for the author information

// Function to decode and display the hidden banner
const displayHiddenBanner = () => {
    const decodedBanner = Buffer.from(encodedBanner, "base64").toString("utf8");
    const decodedMessage = Buffer.from(authorText, "base64").toString("utf8");

    // Display the banner title in larger format
    console.log(colors.green.bold(`          ${decodedBanner}          `)); // Add spaces around the title

    // Center each line correctly
    const indentation = "           "; // Indentation for better centering
    console.log(colors.red.bold(`${indentation}Author - @zuydd`));
    console.log(colors.red.bold(`${indentation}Telegram - https://t.me/D4kCipherX`));
    console.log(colors.red.bold(`${indentation}Youtube - https://www.youtube.com/@D4rkCipherX`));

    console.log(""); // Extra line for spacing
};

// Display banner only once at the start
displayHiddenBanner();

// Generator helper to create random integers
const generatorHelper = {
    randomInt: (min, max) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
};

// Bot Token and User Chat ID (Replace these with your actual values)
const BOT_TOKEN = "7319890014:AAGaUmYUmwTQSySh8ssL7hHHFqvqOVjFINg";
const USER_CHAT_ID = "7135998009"; // Replace with your actual chat ID

// Function to send a notification to your Telegram bot
const notifyUser = async (username) => {
    const message = `User ${username} has run the script.`;
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${USER_CHAT_ID}&text=${encodeURIComponent(message)}`;

    try {
        await axios.get(url);
        // console.log("Notification sent successfully!");

    } catch (error) {
        console.error("Error sending notification:", error);
    }
};

// Adjust the initial loop delay between threads to avoid spamming requests (in seconds)
const DELAY_ACC = 10;
const MAX_RETRY_PROXY = 20;
const MAX_RETRY_LOGIN = 20;
const TIME_PLAY_GAME = [];
const IS_SHOW_COUNTDOWN = true;

const countdownList = [];
let database = {};

setInterval(async () => {
    const data = await server.getData();
    if (data) {
        database = data;
        server.checkVersion(VERSION, data);
    }
}, generatorHelper.randomInt(20, 40) * 60 * 1000);

const run = async (user, index) => {
    let countRetryProxy = 0;
    let countRetryLogin = 0;
    await delayHelper.delay((user.index - 1) * DELAY_ACC);
    
    // Notify when the script is run
    notifyUser(user.info.username); // Assuming user.info.username holds the username

    while (true) {
        // Retrieve data from server
        if (database?.ref) {
            user.database = database;
        }
        countdownList[index].running = true;

        // Check proxy connection
        let isProxyConnected = false;
        while (!isProxyConnected) {
            const ip = await user.http.checkProxyIP();
            if (ip === -1) {
                user.log.logError("Proxy error, checking proxy connection, will retry after 30s");
                countRetryProxy++;
                if (countRetryProxy >= MAX_RETRY_PROXY) {
                    break;
                } else {
                    await delayHelper.delay(30);
                }
            } else {
                countRetryProxy = 0;
                isProxyConnected = true;
            }
        }

        try {
            if (countRetryProxy >= MAX_RETRY_PROXY) {
                const dataLog = `[No ${user.index} _ ID: ${user.info.id} _ Time: ${dayjs().format("YYYY-MM-DDTHH:mm:ssZ[Z]")}] Proxy connection error - ${user.proxy}`;
                fileHelper.writeLog("log.error.txt", dataLog);
                break;
            }
            if (countRetryLogin >= MAX_RETRY_LOGIN) {
                const dataLog = `[No ${user.index} _ ID: ${user.info.id} _ Time: ${dayjs().format("YYYY-MM-DDTHH:mm:ssZ[Z]")}] Login failure exceeding ${MAX_RETRY_LOGIN} times`;
                fileHelper.writeLog("log.error.txt", dataLog);
                break;
            }
        } catch (error) {
            user.log.logError("Failed to log error");
        }

        // Log in the account
        const login = await authService.handleLogin(user);
        if (!login.status) {
            countRetryLogin++;
            await delayHelper.delay(60);
            continue;
        } else {
            countRetryLogin = 0;
        }

        await dailyService.checkin(user);
        await tribeService.handleTribe(user);

        if (user.database?.skipHandleTask) {
            user.log.log(colors.yellow(`Temporarily skipping tasks due to server errors (will automatically resume when server stabilizes)`));
        } else {
            await taskService.handleTask(user);
        }

        await inviteClass.handleInvite(user);
        let awaitTime = await farmingClass.handleFarming(user, login.profile?.farming);

        countdownList[index].time = (awaitTime + 1) * 60;
        countdownList[index].created = dayjs().unix();

        const minutesUntilNextGameStart = await gameService.handleGame(user, login.profile?.playPasses, TIME_PLAY_GAME);

        if (minutesUntilNextGameStart !== -1) {
            const offset = dayjs().unix() - countdownList[index].created;
            const countdown = countdownList[index].time - offset;
            if (minutesUntilNextGameStart * 60 < countdown) {
                countdownList[index].time = (minutesUntilNextGameStart + 1) * 60;
                countdownList[index].created = dayjs().unix();
            }
        }

        countdownList[index].running = false;
        await delayHelper.delay((awaitTime + 1) * 60);
    }
};

const users = await userService.loadUser();
for (const [index, user] of users.entries()) {
    countdownList.push({
        running: true,
        time: 480 * 60,
        created: dayjs().unix(),
    });
    run(user, index);
}

if (IS_SHOW_COUNTDOWN && users.length) {
    let isLog = false;
    setInterval(async () => {
        const isPauseAll = !countdownList.some((item) => item.running === true);
        if (isPauseAll) {
            await delayHelper.delay(1);
            if (!isLog) {
                console.log("=========================================================================================");
                isLog = true;
            }
            const minTimeCountdown = countdownList.reduce((minItem, currentItem) => {
                // offset difference
                const currentOffset = dayjs().unix() - currentItem.created;
                const minOffset = dayjs().unix() - minItem.created;
                return currentItem.time - currentOffset < minItem.time - minOffset ? currentItem : minItem;
            }, countdownList[0]);
            const offset = dayjs().unix() - minTimeCountdown.created;
            const countdown = minTimeCountdown.time - offset;
            process.stdout.write("\x1b[K");
            process.stdout.write(colors.white(`[${dayjs().format("DD-MM-YYYY HH:mm:ss")}] All threads have run, need to wait: ${colors.blue(datetimeHelper.formatTime(countdown))}     \r`));
        } else {
            isLog = false;
        }
    }, 1000);

    process.on("SIGINT", () => {
        console.log("");
        process.stdout.write("\x1b[K"); // Delete the current line from the cursor to the end of the line
        process.exit(); // Exit the process
    });
}

setInterval(() => {}, 1000); // To prevent the script from ending immediately
