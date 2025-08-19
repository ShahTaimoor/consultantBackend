const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Google OAuth routes
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      // Generate JWT token
      const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXP || '365d',
      });

      // Set JWT token in cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
        maxAge: 365 * 24 * 60 * 60 * 1000,
      });

      // Redirect to frontend with success
      res.redirect(`${process.env.FRONTEND_URL}/auth-success?token=${token}`);
    } catch (error) {
      console.error('Google auth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }
  }
);

// Verify Google token and create/login user
router.post('/google/token', async (req, res) => {
  try {
    const { access_token } = req.body;
    
    if (!access_token) {
      return res.status(400).json({ success: false, message: 'Access token required' });
    }

    // Get user info from Google using access token
    const googleResponse = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${access_token}`);
    const googleUser = await googleResponse.json();

    if (!googleUser.id) {
      return res.status(400).json({ success: false, message: 'Invalid access token' });
    }

    // Check if user already exists
    let user = await User.findOne({ googleId: googleUser.id });
    
    if (user) {
      // User exists, generate JWT token
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXP || '365d',
      });
      
      return res.json({
        success: true,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
        token
      });
    }
    
    // Check if user exists with same email
    user = await User.findOne({ email: googleUser.email });
    
    if (user) {
      // Link Google account to existing user
      user.googleId = googleUser.id;
      user.avatar = googleUser.picture;
      await user.save();
      
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXP || '365d',
      });
      
      return res.json({
        success: true,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
        token
      });
    }
    
    // Create new user
    user = await User.create({
      googleId: googleUser.id,
      name: googleUser.name,
      email: googleUser.email,
      avatar: googleUser.picture,
    });
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXP || '365d',
    });
    
    res.json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      token
    });
  } catch (error) {
    console.error('Google token verification error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get current user from session
router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    const user = req.user.toObject();
    delete user.password;
    res.json({ success: true, user });
  } else {
    res.status(401).json({ success: false, message: 'Not authenticated' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Logout error' });
    }
    
    res.cookie('token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
      expires: new Date(0),
    });
    
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

module.exports = router;
