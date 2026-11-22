import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../../models/user.model.js';
import { sendOtpEmail } from '../../services/email.service.js';
import dotenv from 'dotenv';
dotenv.config();

// Helper to generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Register User
 * Steps:
 * 1. Validate fields
 * 2. Check existing user
 * 3. Hash password
 * 4. Generate OTP & 10m expiry
 * 5. Create user in DB
 * 6. Send OTP via Nodemailer
 */
export const register = async (req, res) => {
  let createdUser = null;

  try {
    let { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
      });
    }

    name = name.trim();
    email = email.toLowerCase().trim();

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      if (!existing.isVerified) {
        // User registered but never completed OTP verification
        // Generate a new OTP and resend
        const otp = generateOTP();
        existing.name = name;
        existing.password = await bcrypt.hash(password, 10);
        existing.otp = otp;
        existing.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        await existing.save();

        try {
          await sendOtpEmail(email, name, otp);
        } catch (emailErr) {
          console.error('Failed to send OTP email:', emailErr);
          return res.status(500).json({
            success: false,
            message: 'Failed to send verification email. Please try again.',
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Account was pending verification. A fresh OTP has been sent to your email.',
          email,
        });
      }

      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists. Please log in.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    createdUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'user',
      isActive: false,
      isVerified: false,
      otp,
      otpExpiry,
    });

    try {
      await sendOtpEmail(email, name, otp);
    } catch (emailErr) {
      console.error('Failed to send OTP email, rolling back user:', emailErr);
      if (createdUser?._id) {
        await User.findByIdAndDelete(createdUser._id);
      }
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email. Please check your email address and try again.',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Account created! Please enter the 6-digit verification code sent to your email.',
      email,
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (createdUser?._id) {
      await User.findByIdAndDelete(createdUser._id).catch(() => {});
    }
    return res.status(500).json({
      success: false,
      message: 'Internal server error during registration.',
      error: error.message,
    });
  }
};

/**
 * Verify OTP
 * Steps:
 * 1. Find user by email (or by OTP)
 * 2. Validate OTP and expiration
 * 3. Mark user isVerified = true, isActive = true, clear OTP
 */
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'OTP is required.',
      });
    }

    const cleanOtp = String(otp).trim();

    // Query user either by email and otp or just otp if email not provided
    const query = email ? { email: email.toLowerCase().trim() } : { otp: cleanOtp };
    const user = await User.findOne(query);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP code or user not found.',
      });
    }

    if (user.isVerified) {
      return res.status(200).json({
        success: true,
        message: 'Account is already verified. Please sign in.',
      });
    }

    if (user.otp !== cleanOtp) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect OTP code. Please try again.',
      });
    }

    if (!user.otpExpiry || new Date(user.otpExpiry) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'OTP code has expired. Please request a new one.',
        expired: true,
      });
    }

    user.isVerified = true;
    user.isActive = true;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Account verified successfully! You can now log in.',
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while verifying OTP.',
      error: error.message,
    });
  }
};

/**
 * Resend OTP
 */
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required to resend OTP.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email.',
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'This account is already verified. Please sign in.',
      });
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOtpEmail(user.email, user.name, otp);

    return res.status(200).json({
      success: true,
      message: 'A new OTP has been sent to your email.',
      email: user.email,
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to resend OTP. Please try again later.',
      error: error.message,
    });
  }
};

/**
 * Login
 */
export const login = async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    email = email.toLowerCase().trim();

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address before logging in.',
        needsVerification: true,
        email: user.email,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    user.lastLogin = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Signed in successfully.',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login.',
      error: error.message,
    });
  }
};

/**
 * Get current user profile
 */
export const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user.toJSON(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching profile.',
      error: error.message,
    });
  }
};
