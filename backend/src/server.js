

const dns = require("node:dns")
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config({
    path: require("node:path").resolve(__dirname, "../.env")
});

const app = require("./app");
const connectDB = require("./config/db");

const PORT =  5001;

const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`Smart Community server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
};

startServer();