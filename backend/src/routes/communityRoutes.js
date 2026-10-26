
//const express = require("express");
//const router = express.Router();
//
//const {
//  getCommunities,
//  createCommunity,
//  joinCommunity,
//} = require("../controllers/communityController");
//
//const authMiddleware = require("../middleware/authMiddleware");
//
//// All routes below require a valid access token.
//router.use(authMiddleware);
//
//router.get("/", getCommunities);
//router.post("/", createCommunity);
//router.post("/:id/join", joinCommunity);
//
//module.exports = router;


const express = require("express");
const router = express.Router();

const {
  getCommunities,
  createCommunity,
  joinCommunity,
} = require("../controllers/communityController");

const authMiddleware = require("../middleware/authMiddleware");

// Log every request that reaches this router.
router.use((req, res, next) => {
  console.log(`[COMMUNITY ROUTE] ${req.method} ${req.originalUrl}`);
  next();
});

// Authentication
router.use(authMiddleware);

// Fetch communities
router.get("/", getCommunities);

// Create community
router.post("/", createCommunity);

// Join community
router.post("/:id/join", joinCommunity);

module.exports = router;