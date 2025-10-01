const Queue = require("bull");
const redisConfig = { host: "127.0.0.1", port: 6379 };

const reminderQueue = new Queue("bookingReminder", { redis: redisConfig });

module.exports = { reminderQueue };
