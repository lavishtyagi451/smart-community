const mongoose = require("mongoose");
const Community = require("../models/community");

async function loadCommunity(req, res, next) {
  try {
    const communityId =
      req.params.communityId ||
      req.params.id ||
      req.body.communityId;

    if (!mongoose.isValidObjectId(communityId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid community ID",
      });
    }

    const community = await Community.findById(communityId);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: "Community not found",
      });
    }

    req.community = community;
    next();
  } catch (error) {
    next(error);
  }
}

function requireCommunityMember(req, res, next) {
  const userId = req.user?.id;
  const community = req.community;

  if (!userId || !community) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const isOwner =
    String(community.owner) === String(userId);

  const isMember = community.members.some(
    (memberId) => String(memberId) === String(userId)
  );

  if (!isOwner && !isMember) {
    return res.status(403).json({
      success: false,
      message: "Community membership required",
    });
  }

  next();
}

function requireCommunityOwner(req, res, next) {
  const userId = req.user?.id;
  const community = req.community;

  if (
    !userId ||
    !community ||
    String(community.owner) !== String(userId)
  ) {
    return res.status(403).json({
      success: false,
      message: "Only the community owner can perform this action",
    });
  }

  next();
}

module.exports = {
  loadCommunity,
  requireCommunityMember,
  requireCommunityOwner,
};

