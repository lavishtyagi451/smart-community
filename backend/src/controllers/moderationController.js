const mongoose = require("mongoose");
const ModerationLog = require("../models/ModerationLog");
const ModerationReport = require("../models/ModerationReport");
const { getMessageTarget } = require("../services/moderationTargetAdapter");
const { moderateText } = require("../services/aiModerationService");

function isMember(community, userId) {
  return String(community.owner) === String(userId) ||
    (community.members || []).some((id) => String(id) === String(userId));
}

function isOwner(community, userId) {
  return String(community.owner) === String(userId);
}

async function reportMessage(req, res, next) {
  try {
    const { messageId } = req.params;
    const reason = typeof req.body.reason === "string" ? req.body.reason.trim() : "";
    const userId = req.user?.id;

    if (!mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ success: false, message: "Invalid message ID" });
    }
    if (!reason || reason.length < 3 || reason.length > 1000) {
      return res.status(400).json({ success: false, message: "Reason must be between 3 and 1000 characters" });
    }

    const target = await getMessageTarget(messageId);

if (!target) {
  return res.status(404).json({
    success: false,
    message: "Message, channel, or community not found",
  });
}

if (!isMember(target.community, userId)) {
  return res.status(403).json({
    success: false,
    message: "Only community members can report content in this community",
  });
}

    const existing = await ModerationReport.findOne({
      targetId: messageId,
      reporter: userId,
      status: "pending",
    }).lean();

    if (existing) {
      return res.status(409).json({ success: false, message: "You already have a pending report for this message" });
    }

    const report = await ModerationReport.create({
      community: target.communityId,
      targetType: "message",
      targetId: messageId,
      reporter: userId,
      reason,
    });

    const aiResult = typeof target.message.content === "string"
      ? await moderateText(target.message.content, "message")
      : { status: "unavailable", category: "", confidence: null };

    await ModerationLog.create({
      community: target.communityId,
      actor: userId,
      targetType: "message",
      targetId: messageId,
      action: aiResult.status === "flagged" ? "content_flagged" : "content_reported",
      reason,
      details: { reportId: report._id },
      aiResult,
    });

    return res.status(201).json({
      success: true,
      message: "Message reported successfully",
      report: {
        id: report._id,
        status: report.status,
        createdAt: report.createdAt,
      },
      aiModeration: aiResult,
    });
  } catch (error) {
    next(error);
  }
}

async function listReports(req, res, next) {
  try {
    const { communityId } = req.params;
    if (!mongoose.isValidObjectId(communityId)) {
      return res.status(400).json({ success: false, message: "Invalid community ID" });
    }

    const Community = require("../models/community");
    const community = await Community.findById(communityId).select("owner members visibility").lean();
    if (!community) return res.status(404).json({ success: false, message: "Community not found" });
    if (!isOwner(community, req.user.id)) {
      return res.status(403).json({ success: false, message: "Only the community owner can review reports until member roles are implemented" });
    }

    const limitRaw = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 25;
    const status = req.query.status || "pending";
    if (!["pending", "reviewed", "dismissed", "all"].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be pending, reviewed, dismissed, or all" });
    }

    const filter = { community: communityId };
    if (status !== "all") filter.status = status;

    const reports = await ModerationReport.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("reporter", "name email")
      .lean();

    return res.status(200).json({ success: true, count: reports.length, reports });
  } catch (error) {
    next(error);
  }
}

async function resolveReport(req, res, next) {
  try {
    const { reportId } = req.params;
    const { decision, resolution = "" } = req.body || {};
    if (!mongoose.isValidObjectId(reportId)) {
      return res.status(400).json({ success: false, message: "Invalid report ID" });
    }
    if (!["dismiss", "remove"].includes(decision)) {
      return res.status(400).json({ success: false, message: "decision must be dismiss or remove" });
    }
    if (typeof resolution !== "string" || resolution.length > 1000) {
      return res.status(400).json({ success: false, message: "resolution must be a string up to 1000 characters" });
    }

    const report = await ModerationReport.findById(reportId);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });

    const Community = require("../models/community");
    const community = await Community.findById(report.community).select("owner members visibility").lean();
    if (!community) return res.status(404).json({ success: false, message: "Community not found" });
    if (!isOwner(community, req.user.id)) {
      return res.status(403).json({ success: false, message: "Only the community owner can resolve reports until member roles are implemented" });
    }
    if (report.status !== "pending") {
      return res.status(409).json({ success: false, message: "This report has already been resolved" });
    }

    let action = "report_dismissed";
    if (decision === "remove") {
      const target = await getMessageTarget(String(report.targetId));

    if (!target || !target.message?._id) {
      return res.status(404).json({
      success: false,
      message: "Reported message, channel, or community not found",
      });
}
      // Soft delete only if Partner 1 has implemented a `deletedAt` field.
      const adapter = require("../services/messageModerationActions");
      await adapter.removeMessage(String(report.targetId), req.user.id, resolution);
      action = "content_removed";
    }

    report.status = decision === "dismiss" ? "dismissed" : "reviewed";
    report.reviewedBy = req.user.id;
    report.reviewedAt = new Date();
    report.resolution = resolution.trim();
    await report.save();

    await ModerationLog.create({
      community: report.community,
      actor: req.user.id,
      targetType: "message",
      targetId: report.targetId,
      action,
      reason: resolution.trim() || decision,
      details: { reportId: report._id, decision },
      aiResult: { status: "not_requested" },
    });

    return res.status(200).json({ success: true, message: "Report resolved", report });
  } catch (error) {
    next(error);
  }
}

async function scanText(req, res, next) {
  try {
    const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
    if (!text || text.length > 5000) {
      return res.status(400).json({ success: false, message: "text is required and must be no longer than 5000 characters" });
    }
    const result = await moderateText(text, "message");
    return res.status(200).json({ success: true, result });
  } catch (error) {
    next(error);
  }
}

module.exports = { reportMessage, listReports, resolveReport, scanText };
