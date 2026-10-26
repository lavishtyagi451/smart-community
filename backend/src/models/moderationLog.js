const mongoose = require("mongoose");

const moderationLogSchema = new mongoose.Schema(
  {
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ["message", "user", "community", "channel"],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        "content_reported",
        "content_flagged",
        "content_approved",
        "content_removed",
        "user_warned",
        "user_suspended",
        "report_dismissed",
      ],
      required: true,
    },
    reason: { type: String, trim: true, maxlength: 1000, default: "" },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    aiResult: {
      status: {
        type: String,
        enum: ["flagged", "clear", "unavailable", "not_requested"],
        default: "not_requested",
      },
      category: { type: String, default: "" },
      confidence: { type: Number, min: 0, max: 1, default: null },
    },
  },
  { timestamps: true, versionKey: false }
);

moderationLogSchema.index({ community: 1, createdAt: -1 });

module.exports = mongoose.model("ModerationLog", moderationLogSchema);
