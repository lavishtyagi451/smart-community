/**
 * Small reusable validators. Use only known schemas; never assume request input is trusted.
 */
const validateObjectId = (paramName) => (req, res, next) => {
  const mongoose = require("mongoose");
  const value = req.params[paramName];

  if (!mongoose.isValidObjectId(value)) {
    return res.status(400).json({
      success: false,
      message: `Invalid ${paramName}`,
    });
  }
  next();
};

const validateBody = (rules) => (req, res, next) => {
  const body = req.body || {};
  const errors = [];

  for (const [field, rule] of Object.entries(rules)) {
    const value = body[field];

    if (rule.required && (value === undefined || value === null || String(value).trim() === "")) {
      errors.push(`${field} is required`);
      continue;
    }
    if (value !== undefined && rule.type === "string" && typeof value !== "string") {
      errors.push(`${field} must be a string`);
      continue;
    }
    if (typeof value === "string") {
      if (rule.min && value.trim().length < rule.min) errors.push(`${field} must be at least ${rule.min} characters`);
      if (rule.max && value.trim().length > rule.max) errors.push(`${field} must be at most ${rule.max} characters`);
      if (rule.enum && !rule.enum.includes(value.trim())) errors.push(`${field} has an unsupported value`);
    }
  }

  if (errors.length) {
    return res.status(400).json({ success: false, message: "Validation failed", errors });
  }
  next();
};

module.exports = { validateObjectId, validateBody };
