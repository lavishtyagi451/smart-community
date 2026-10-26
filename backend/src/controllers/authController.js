const User = require("../models/user");

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const generateOTP = require("../utils/generateOTP");
const sendEmail = require("../utils/sendEmail");

const {
    generateAccessToken,
    generateRefreshToken
} = require("../utils/generateTokens");


// Small helper functions to avoid repeating the same code

const normalizeEmail = (email) => email.trim().toLowerCase();

const hashToken = (token) => {
    return crypto.createHash("sha256").update(token).digest("hex");
};

const verifyRefreshToken = (token) => {
    return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, {
        algorithms: ["HS256"],
        issuer: "smart-community",
        audience: "smart-community-client"
    
    });
};

const isJWTError = (error) => {
    return [
        "TokenExpiredError",
        "JsonWebTokenError",
        "NotBeforeError"
    ].includes(error.name);
};

const findSessionUser = async (decoded) => {
    const user = await User.findById(decoded.sub).select(
        "+refreshTokenHash +refreshTokenSessionId"
    );

    if (
        !user ||
        !user.isVerified ||
        user.refreshTokenSessionId !== decoded.sid
    ) {
        return null;
    }

    return user;
};


// 1. Register a new user

const registerUser = async (req, res) => {
    try {
        let { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required"
            });
        }

        name = name.trim();
        email = normalizeEmail(email);

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Name cannot be empty"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters long"
            });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists"
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const otp = generateOTP();
        const otpHash = await bcrypt.hash(otp, 10);

        const user = await User.create({
            name,
            email,
            passwordHash,
            isVerified: false,
            otpHash,
            otpExpiryAt: new Date(Date.now() + 5 * 60 * 1000),
            otpAttempts: 0,
            otpResendCount: 0
        });

        try {
            await sendEmail({
            to: email,
            subject: "Verify your Smart Community account",
            textContent: `Your OTP is ${otp}. It expires in 5 minutes.`,
            htmlContent: `         <h2>Smart Community</h2>         <p>Your email verification OTP is:</p>         <h1>${otp}</h1>         <p>This OTP expires in 5 minutes.</p>         <p>Do not share this code with anyone.</p>
    `
});

        } catch (error) {
            // Remove the account if the verification email cannot be sent
            await User.findByIdAndDelete(user._id);

            console.error("OTP email error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Could not send verification email. Please try again."
            });
        }

        return res.status(201).json({
            success: true,
            message: "Registration successful. Please verify your email using the OTP."
        });

    } catch (error) {
        console.error("Registration error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// 2. Verify OTP

const verifyOTP = async (req, res) => {
    try {
        let { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required"
            });
        }

        email = normalizeEmail(email);
        otp = String(otp).trim();

        const user = await User.findOne({ email }).select(
            "+otpHash +otpExpiryAt +otpAttempts"
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (user.isVerified) {
            return res.status(400).json({
                success: false,
                message: "Email is already verified"
            });
        }

        if (!user.otpHash || !user.otpExpiryAt) {
            return res.status(400).json({
                success: false,
                message: "No active OTP found. Please request a new OTP."
            });
        }

        if (user.otpExpiryAt < new Date()) {
            user.otpHash = undefined;
            user.otpExpiryAt = undefined;
            user.otpAttempts = 0;

            await user.save();

            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a new one."
            });
        }

        if (user.otpAttempts >= 3) {
            return res.status(429).json({
                success: false,
                message: "Too many incorrect attempts. Please request a new OTP."
            });
        }

        const isCorrectOTP = await bcrypt.compare(otp, user.otpHash);

        if (!isCorrectOTP) {
            user.otpAttempts += 1;
            await user.save();

            return res.status(400).json({
                success: false,
                message: "Invalid OTP"
            });
        }

        user.isVerified = true;
        user.otpHash = undefined;
        user.otpExpiryAt = undefined;
        user.otpAttempts = 0;

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Email verified successfully. You can now log in."
        });

    } catch (error) {
        console.error("OTP verification error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// 3. Resend OTP

const resendOTP = async (req, res) => {
    try {
        let { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        email = normalizeEmail(email);

        const user = await User.findOne({ email }).select(
            "+otpHash +otpExpiryAt +otpAttempts +otpResendCount"
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (user.isVerified) {
            return res.status(400).json({
                success: false,
                message: "Email is already verified"
            });
        }

        if (user.otpResendCount >= 3) {
            return res.status(429).json({
                success: false,
                message: "OTP resend limit reached"
            });
        }

        const otp = generateOTP();
        const otpHash = await bcrypt.hash(otp, 10);

        // Save the new OTP before sending it
        user.otpHash = otpHash;
        user.otpExpiryAt = new Date(Date.now() + 5 * 60 * 1000);
        user.otpAttempts = 0;
        user.otpResendCount += 1;

        await user.save();

        try {
            await sendEmail({
            to: email,
            subject: "Your new Smart Community verification OTP",
            textContent: `Your new OTP is ${otp}. It expires in 5 minutes.`,
            htmlContent: `         <h2>Smart Community</h2>         <p>Your new email verification OTP is:</p>         <h1>${otp}</h1>         <p>This OTP expires in 5 minutes.</p>         <p>Do not share this code with anyone.</p>
    `
});

        } catch (error) {
            console.error("Resend OTP email error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Could not send OTP email. Please try again."
            });
        }

        return res.status(200).json({
            success: true,
            message: "A new OTP has been sent to your email"
        });

    } catch (error) {
        console.error("Resend OTP error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// 4. Login user

const loginUser = async (req, res) => {
    try {
        let { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        email = normalizeEmail(email);

        const user = await User.findOne({ email }).select("+passwordHash");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const isPasswordCorrect = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!isPasswordCorrect) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        if (!user.isVerified) {
            return res.status(403).json({
                success: false,
                message: "Please verify your email before logging in"
            });
        }

        const sessionId = crypto.randomUUID();

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id, sessionId);

        user.refreshTokenHash = hashToken(refreshToken);
        user.refreshTokenSessionId = sessionId;

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Login successful",
            accessToken,
            refreshToken,
            tokenType: "Bearer",
            expiresIn: 900
        });

    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// 5. Refresh access token

const refreshAccessToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: "Refresh token is required"
            });
        }

        const decoded = verifyRefreshToken(refreshToken);

        if (
            decoded.tokenType !== "refresh" ||
            !decoded.sub ||
            !decoded.sid
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid refresh token"
            });
        }

        const user = await findSessionUser(decoded);

        if (!user || user.refreshTokenHash !== hashToken(refreshToken)) {
            return res.status(401).json({
                success: false,
                message: "Invalid refresh session"
            });
        }

        const accessToken = generateAccessToken(user._id);

        // Rotate the refresh token so the old one cannot be reused
        const newRefreshToken = generateRefreshToken(user._id, decoded.sid);

        user.refreshTokenHash = hashToken(newRefreshToken);

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Tokens refreshed successfully",
            accessToken,
            refreshToken: newRefreshToken,
            tokenType: "Bearer",
            expiresIn: 900
        });

    } catch (error) {
        if (isJWTError(error)) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired refresh token"
            });
        }

        console.error("Refresh token error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// 6. Logout user

const logoutUser = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: "Refresh token is required"
            });
        }

        const decoded = verifyRefreshToken(refreshToken);

        if (
            decoded.tokenType !== "refresh" ||
            !decoded.sub ||
            !decoded.sid
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid refresh token"
            });
        }

        const user = await findSessionUser(decoded);

        if (!user || user.refreshTokenHash !== hashToken(refreshToken)) {
            return res.status(401).json({
                success: false,
                message: "Invalid refresh session"
            });
        }

        user.refreshTokenHash = undefined;
        user.refreshTokenSessionId = undefined;

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Logout successful"
        });

    } catch (error) {
        if (isJWTError(error)) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired refresh token"
            });
        }

        console.error("Logout error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }

};

    //forgot  password
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || typeof email !== "string") {
            return res.status(400).json({
                success: false,
                message: "Email is required.",
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail,
        });

        // Don't reveal whether an account exists.
        const response = {
            success: true,
            message:
                "If an account exists with this email, a password reset link will be sent.",
        };

        if (!user) {
            return res.status(200).json(response);
        }

        // Generate a secure random token.
        const resetToken = crypto.randomBytes(32).toString("hex");

        // Store only the hash in the database.
        const resetTokenHash = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");

        user.passwordResetTokenHash = resetTokenHash;

        user.passwordResetExpiresAt = new Date(
            Date.now() + 15 * 60 * 1000
        );

        await user.save();

        const frontendUrl = process.env.FRONTEND_URL;

        if (!frontendUrl) {
            throw new Error("FRONTEND_URL is not configured.");
        }

        const resetLink =
            `${frontendUrl.replace(/\/$/, "")}` +
            `/reset-password?token=${resetToken}`;

        await sendEmail({
        to: user.email,
        subject: "Reset Your Smart Community Password",
        textContent: `Reset your password using this link: ${resetLink}`,
        htmlContent: `
                    <h2>Password Reset</h2>
                    <p>Click the link below to reset your password.</p>
                    <a href="${resetLink}">Reset Password</a>
                    <p>This link expires in 15 minutes.</p>
    `
        });

        return res.status(200).json(response);
    } catch (error) {
        console.error("Forgot password error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to process the password reset request.",
        });
    }
};

//reset password
const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (
            typeof token !== "string" ||
            !token.trim() ||
            typeof newPassword !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Token and new password are required.",
            });
        }

        
        if (newPassword.length < 12) {
            return res.status(400).json({
                success: false,
                message:
                    "Password must be at least 12 characters long.",
            });
        }

        
        if (Buffer.byteLength(newPassword, "utf8") > 72) {
            return res.status(400).json({
                success: false,
                message:
                    "Password must not exceed 72 UTF-8 bytes.",
            });
        }

        // hashing the submitted token so it can be compared with
        // the hash stored in MongoDB.
        const resetTokenHash = crypto
            .createHash("sha256")
            .update(token.trim())
            .digest("hex");

        
        const user = await User.findOne({
            passwordResetTokenHash: resetTokenHash,
            passwordResetExpiresAt: {
                $gt: new Date(),
            },
        }).select(
            "+passwordResetTokenHash +passwordResetExpiresAt"
        );

        if (!user) {
            return res.status(400).json({
                success: false,
                message:
                    "Password reset link is invalid or has expired.",
            });
        }

        // Hash the new password before storing it.
        const passwordHash = await bcrypt.hash(newPassword, 12);

        user.passwordHash = passwordHash;

        // Invalidate the reset token so it cannot be reused.
        user.passwordResetTokenHash = undefined;
        user.passwordResetExpiresAt = undefined;

        await user.save();

        return res.status(200).json({
            success: true,
            message:
                "Password reset successful. Please log in with your new password.",
        });
    } catch (error) {
        console.error("Reset password error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to reset password.",
        });
    }
};



module.exports = {
    registerUser,
    verifyOTP,
    resendOTP,
    loginUser,
    refreshAccessToken,
    logoutUser,
    forgotPassword,
    resetPassword,
};