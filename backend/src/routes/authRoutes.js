const express = require("express");
const router = express.Router();

const {
    registerUser,
    verifyOTP,
    resendOTP,
    loginUser,
    refreshAccessToken,
    logoutUser,
    forgotPassword,
    resetPassword
} = require("../controllers/authController");

// Registration and OTP verification
router.post("/register", registerUser);
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOTP);

// Login and token 
router.post("/login", loginUser);
router.post("/refresh-token", refreshAccessToken);
router.post("/logout", logoutUser);

// Password reset
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;