const mongoose = require("mongoose");

const moderationReportSchema = new mongoose.Schema(
  {
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ["message"],
      required: true,
      default: "message",
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "dismissed"],
      default: "pending",
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    resolution: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  { timestamps: true, versionKey: false }
);

moderationReportSchema.index({ community: 1, status: 1, createdAt: -1 });
moderationReportSchema.index({ targetId: 1, reporter: 1 });

module.exports = mongoose.model("ModerationReport", moderationReportSchema);
