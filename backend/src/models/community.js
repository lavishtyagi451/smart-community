
const mongoose = require("mongoose");

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 80,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    category: {
      type: String,
      trim: true,
      default: "General",
    },

    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Community", communitySchema);