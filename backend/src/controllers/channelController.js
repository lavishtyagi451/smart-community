const mongoose = require("mongoose");
const Channel = require("../models/channel");
const Community = require("../models/community");

const createChannel = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const { name, description = "", type = "text" } = req.body;

    if (!name || typeof name !== "string" ||
        name.trim().length < 2 || name.trim().length > 80) {
      return res.status(400).json({
        success: false,
        message: "Channel name must be 2–80 characters",
      });
    }

    if (!["text", "announcement"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid channel type",
      });
    }

    if (typeof description !== "string" ||
        description.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Description must be at most 500 characters",
      });
    }

    const channel = await Channel.create({
      name: name.trim(),
      description: description.trim(),
      community: communityId,
      createdBy: req.user.id,
      type,
    });

    return res.status(201).json({
      success: true,
      message: "Channel created successfully",
      channel,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A channel with this name already exists in the community",
      });
    }
    next(error);
  }
};

const getChannels = async (req, res, next) => {
  try {
    const channels = await Channel.find({
      community: req.params.communityId,
    })
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: channels.length,
      channels,
    });
  } catch (error) {
    next(error);
  }
};

const getChannelById = async (req, res, next) => {
  try {
    const channel = await Channel.findById(
      req.params.channelId
    ).lean();

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found",
      });
    }

    return res.status(200).json({
      success: true,
      channel,
    });
  } catch (error) {
    next(error);
  }
};

const updateChannel = async (req, res, next) => {
  try {
    const updates = {};
    const { name, description, type } = req.body;

    if (name !== undefined) {
      if (typeof name !== "string" ||
          name.trim().length < 2 ||
          name.trim().length > 80) {
        return res.status(400).json({
          success: false,
          message: "Channel name must be 2–80 characters",
        });
      }
      updates.name = name.trim();
    }

    if (description !== undefined) {
      if (typeof description !== "string" ||
          description.length > 500) {
        return res.status(400).json({
          success: false,
          message: "Invalid description",
        });
      }
      updates.description = description.trim();
    }

    if (type !== undefined) {
      if (!["text", "announcement"].includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Invalid channel type",
        });
      }
      updates.type = type;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one valid field to update",
      });
    }

    const channel = await Channel.findByIdAndUpdate(
      req.params.channelId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Channel updated successfully",
      channel,
    });
  } catch (error) {
    next(error);
  }
};

const deleteChannel = async (req, res, next) => {
  try {
    const channel = await Channel.findByIdAndDelete(
      req.params.channelId
    );

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Channel deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createChannel,
  getChannels,
  getChannelById,
  updateChannel,
  deleteChannel,
};

