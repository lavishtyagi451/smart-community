const express = require("express");
const app = express();

app.use(express.json());

//import routes
const communityRoutes = require("./routes/communityRoutes");
const authRoutes = require("./routes/authRoutes");
const channelRoutes = require("./routes/channelRoutes");
const moderationRoutes = require("./routes/moderationRoutes");



app.use("/api/communities", communityRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/moderation", moderationRoutes);


app.get("/", (req, res) => {
res.status(200).json({
message: "Welcome to the CSI Auth System API"
});
});

app.get("/api/health", (req, res) => {
console.log("health ROUTE HIT");
res.status(200).json({
message: "Backend is healthy"
});
});

module.exports = app;
