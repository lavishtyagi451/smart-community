const mongoose = require("mongoose");
const Community = require("../models/community");

/**
 * Requires req.user.id (provided by existing authMiddleware).
 * Membership is stored as Community.members: [ObjectId].
 */
const requireCommunityMember = async (req, res, next) => {
  try {
    const communityId = req.params.communityId || req.params.id || req.body.communityId;
    const userId = req.user?.id;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: "Authenticated user ID is missing or invalid" });
    }
    if (!communityId || !mongoose.isValidObjectId(communityId)) {
      return res.status(400).json({ success: false, message: "Valid communityId is required" });
    }

    const community = await Community.findById(communityId).select("owner members visibility").lean();
    if (!community) {
      return res.status(404).json({ success: false, message: "Community not found" });
    }

    const isOwner = String(community.owner) === String(userId);
    const isMember = (community.members || []).some((id) => String(id) === String(userId));

    if (community.visibility === "private" && !isMember) {
      return res.status(403).json({ success: false, message: "You do not have access to this private community" });
    }
    if (!isMember && !isOwner) {
      return res.status(403).json({ success: false, message: "Community membership is required" });
    }

    req.community = community;
    req.communityId = community._id;
    req.isCommunityOwner = isOwner;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Owner-only guard compatible with the current Community schema.
 * Do not claim admin/moderator support until member roles are actually stored.
 */
const requireCommunityOwner = (req, res, next) => {
  if (!req.community || !req.user?.id) {
    return res.status(500).json({ success: false, message: "Authorization middleware was not initialized" });
  }
  if (String(req.community.owner) !== String(req.user.id)) {
    return res.status(403).json({ success: false, message: "Community owner permission is required" });
  }
  next();
};

module.exports = { requireCommunityMember, requireCommunityOwner };
