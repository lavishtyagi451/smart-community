const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  loadCommunity,
  requireCommunityMember,
  requireCommunityOwner,
} = require("../middleware/communityPermissions");

const {
  createChannel,
  getChannels,
  getChannelById,
  updateChannel,
  deleteChannel,
} = require("../controllers/channelController");

const Channel = require("../models/channel");
const mongoose = require("mongoose");

// Authenticate every channel request.
router.use(authMiddleware);

// Validate a channel ID, load the channel and its parent community.
async function loadChannelAndCommunity(req, res, next) {
  try {
    const { channelId } = req.params;

    if (!mongoose.isValidObjectId(channelId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid channel ID",
      });
    }

    const channel = await Channel.findById(channelId);

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found",
      });
    }

    // Resolve the community associated with this channel.
    req.params.communityId = String(channel.community);
    req.channel = channel;

    next();
  } catch (error) {
    next(error);
  }
}

// CREATE CHANNEL — community owner only.
router.post(
  "/communities/:communityId/channels",
  loadCommunity,
  requireCommunityOwner,
  createChannel
);

// GET ALL CHANNELS — community members only.
router.get(
  "/communities/:communityId/channels",
  loadCommunity,
  requireCommunityMember,
  getChannels
);

// GET CHANNEL DETAILS — community members only.
router.get(
  "/:channelId",
  loadChannelAndCommunity,
  loadCommunity,
  requireCommunityMember,
  getChannelById
);

// UPDATE CHANNEL — community owner only.
router.patch(
  "/:channelId",
  loadChannelAndCommunity,
  loadCommunity,
  requireCommunityOwner,
  updateChannel
);

// DELETE CHANNEL — community owner only.
router.delete(
  "/:channelId",
  loadChannelAndCommunity,
  loadCommunity,
  requireCommunityOwner,
  deleteChannel
);

// Error handler for channel routes.
router.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  console.error("[CHANNEL ERROR]", error);

  return res.status(500).json({
    success: false,
    message: "Channel operation failed",
  });
});

module.exports = router;

