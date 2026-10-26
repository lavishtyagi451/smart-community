
const mongoose = require("mongoose");
const Community = require("../models/community");



// GET /api/communities
// Show public communities and indicate membership.

const getCommunities = async (req, res) => {
  console.log("[GET COMMUNITIES] Request received");

  try {
    // Check whether authentication middleware supplied a user.
    const userId = req.user?.sub;

    console.log("[GET COMMUNITIES] User ID:", userId);

    // Verify that the database connection is available.
    const mongoose = require("mongoose");

    if (mongoose.connection.readyState !== 1) {
      console.error(
        "[GET COMMUNITIES] MongoDB is not connected. State:",
        mongoose.connection.readyState
      );

      return res.status(503).json({
        success: false,
        message: "Database is not connected",
      });
    }

    // Fetch public communities from MongoDB.
    const communities = await Community.find({
      visibility: "public",
    })
      .select("name description category owner members createdAt")
      .sort({ createdAt: -1 })
      .lean();

    console.log(
      "[GET COMMUNITIES] Communities found:",
      communities.length
    );

    // Build a safe response for the dashboard.
    const result = communities.map((community) => {
      const members = Array.isArray(community.members)
        ? community.members
        : [];

      const isMember = userId
        ? members.some(
            (memberId) =>
              memberId != null &&
              memberId.toString() === userId.toString()
          )
        : false;

      return {
        _id: community._id,
        name: community.name,
        description: community.description,
        category: community.category,
        owner: community.owner,
        memberCount: members.filter(
          (memberId) => memberId != null
        ).length,
        isMember,
        createdAt: community.createdAt,
      };
    });

    return res.status(200).json({
      success: true,
      count: result.length,
      communities: result,
    });
  } catch (error) {
    console.error("[GET COMMUNITIES] ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch communities",
      ...(process.env.NODE_ENV !== "production" && {
        debug: error.message,
      }),
    });
  }
};

// POST /api/communities
// Create a community.
const createCommunity = async (req, res) => {
  try {
    const { name, description, category, visibility } = req.body;
    const userId = req.user.sub;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Community name is required",
      });
    }

    if (visibility && !["public", "private"].includes(visibility)) {
      return res.status(400).json({
        success: false,
        message: "Visibility must be public or private",
      });
    }

    const community = await Community.create({
      name: name.trim(),
      description,
      category,
      visibility,
      owner: req.user.id,
      members: [userId],
    });

    return res.status(201).json({
      success: true,
      message: "Community created successfully",
      community: {
        _id: community._id,
        name: community.name,
        description: community.description,
        category: community.category,
        visibility: community.visibility,
        owner: community.owner,
        memberCount: community.members.length,
      },
    });
  } catch (error) {
    console.error("Create community error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create community",
    });
  }
};

// POST /api/communities/:id/join
// Join an existing public community.
const joinCommunity = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid community ID",
      });
    }

    const community = await Community.findOneAndUpdate(
      {
        _id: id,
        visibility: "public",
        members: { $ne: userId },
      },
      {
        $addToSet: { members: userId },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (community) {
      return res.status(200).json({
        success: true,
        message: "Joined community successfully",
        community: {
          _id: community._id,
          name: community.name,
          memberCount: community.members.length,
        },
      });
    }

    // Find out why the update did not match.
    const existingCommunity = await Community.findById(id);

    if (!existingCommunity) {
      return res.status(404).json({
        success: false,
        message: "Community not found",
      });
    }

    if (existingCommunity.visibility !== "public") {
      return res.status(403).json({
        success: false,
        message: "This community is private",
      });
    }

    return res.status(409).json({
      success: false,
      message: "You are already a member",
    });
  } catch (error) {
    console.error("Join community error:", error);
    
    return res.status(500).json({
      success: false,
      message: "Failed to join community",
    });
  }
};

module.exports = {
  getCommunities,
  createCommunity,
  joinCommunity,
};