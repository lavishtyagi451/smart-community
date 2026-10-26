const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const rateLimiter = require("../middleware/rateLimiter");
const { validateObjectId } = require("../middleware/validateRequest");
const {
  reportMessage,
  listReports,
  resolveReport,
  scanText,
} = require("../controllers/moderationController");

router.use(authMiddleware);

// Report endpoint is rate-limited per authenticated user.
router.post(
  "/messages/:messageId/report",
  rateLimiter({ windowMs: 60_000, max: 5, message: "Too many reports. Please wait before trying again." }),
  validateObjectId("messageId"),
  reportMessage
);

// Only community owner can list reports / resolve them in the current schema.
router.get(
  "/communities/:communityId/reports",
  rateLimiter({ windowMs: 60_000, max: 30 }),
  validateObjectId("communityId"),
  listReports
);

router.patch(
  "/reports/:reportId/resolve",
  rateLimiter({ windowMs: 60_000, max: 20 }),
  validateObjectId("reportId"),
  resolveReport
);

// Optional authenticated endpoint useful for UI previews/testing; not a substitute for moderation on message submission.
router.post(
  "/scan",
  rateLimiter({ windowMs: 60_000, max: 10 }),
  scanText
);

// Centralized error handler for this router.
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  if (status >= 500) console.error("[MODERATION ERROR]", error);
  return res.status(status).json({
    success: false,
    message: status >= 500 && process.env.NODE_ENV === "production"
      ? "Moderation service failed"
      : error.message || "Moderation request failed",
  });
});

module.exports = router;
