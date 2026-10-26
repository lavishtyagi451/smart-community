/**
 * This adapter intentionally does not hard-delete messages.
 * Configure it to match Partner 1's model and soft-delete policy.
 */
let Message;
try { Message = require("../models/Message"); }
catch (_) { Message = null; }

async function removeMessage(messageId, moderatorId, reason) {
  if (!Message) {
    const error = new Error("Message model not found; cannot remove message");
    error.statusCode = 503;
    throw error;
  }

  const schema = Message.schema;
  if (!schema.path("deletedAt")) {
    const error = new Error(
      "Partner 1's Message schema must implement deletedAt for soft deletion, or this adapter must be updated to their approved deletion mechanism."
    );
    error.statusCode = 501;
    throw error;
  }

  const update = { deletedAt: new Date() };
  if (schema.path("moderationReason")) update.moderationReason = reason || "Removed by moderator";
  if (schema.path("moderatedBy")) update.moderatedBy = moderatorId;

  const result = await Message.findByIdAndUpdate(messageId, update, { new: true });
  if (!result) {
    const error = new Error("Message not found");
    error.statusCode = 404;
    throw error;
  }
  return result;
}

module.exports = { removeMessage };
