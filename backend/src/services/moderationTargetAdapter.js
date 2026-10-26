//const mongoose = require("mongoose");
//const Community = require("../models/community");
//
///**
// * Adapter boundary for Partner 1's Message and Channel models.
// * Verify model filenames and fields against their actual implementation before evaluation.
// */
//let Message;
//let Channel;
//
//try {
//  Message = require("../models/Message");
//} catch (_) {
//  Message = null;
//}
//try {
//  Channel = require("../models/channel");
//} catch (_) {
//  Channel = null;
//}
//
//async function getMessageTarget(messageId) {
//  if (!mongoose.isValidObjectId(messageId)) {
//    const error = new Error("Invalid message ID");
//    error.statusCode = 400;
//    throw error;
//  }
//  if (!Message) {
//    const error = new Error("Message model not found. Connect this adapter to Partner 1's actual Message model.");
//    error.statusCode = 503;
//    throw error;
//  }
//
//  const message = await Message.findById(messageId).lean();
//  if (!message) {
//    const error = new Error("Message not found");
//    error.statusCode = 404;
//    throw error;
//  }
//
//  // Assumes message.channel references Channel and channel.community references Community.
//  if (!Channel || !message.channel) {
//    const error = new Error("Message-to-channel relation is not configured in moderationTargetAdapter.js");
//    error.statusCode = 503;
//    throw error;
//  }
//
//  const channel = await Channel.findById(message.channel).select("community").lean();
//  if (!channel || !channel.community) {
//    const error = new Error("Channel or its community was not found");
//    error.statusCode = 404;
//    throw error;
//  }
//
//  const community = await Community.findById(channel.community).select("owner members visibility").lean();
//  if (!community) {
//    const error = new Error("Community not found");
//    error.statusCode = 404;
//    throw error;
//  }
//
//  return { message, channel, community, communityId: community._id };
//}
//
//module.exports = { getMessageTarget };



const Message = require("../models/Message");
const Channel = require("../models/channel");
const Community = require("../models/community");

async function getMessageTarget(messageId) {
  const message = await Message.findById(messageId);

  if (!message) {
    return null;
  }

  const channel = await Channel.findById(message.channel);

  if (!channel) {
    return null;
  }

  const community = await Community.findById(channel.community);

  if (!community) {
    return null;
  }

  return {
    message,
    channel,
    community,
    communityId: community._id,
  };
}

module.exports = {
  getMessageTarget,
};