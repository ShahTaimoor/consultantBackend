const express = require('express');

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { isAdmin, isAuthorized } = require('../middleware/authMiddleware');


const router = express.Router();

// Signup
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { name }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User with this email or name already exists' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error during registration');
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid email or password' });

    // Check if user has password (not Google-only user)
    if (!user.password) {
      return res.status(400).json({ message: 'Please use Google authentication' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

    user.password = undefined;

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXP || '365d',
    });

    return res.cookie('token', token, {
      httpOnly: true,
      secure: true, 
      sameSite: 'None',
      maxAge: 365 * 24 * 60 * 60 * 1000,
    }).status(200).json({
      success: true,
      user,
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error during login');
  }
});

// Logout
router.get('/logout', (req, res) => {
  return res.cookie('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    expires: new Date(0),
  }).status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

// Add POST logout route for consistency
router.post('/logout', (req, res) => {
  return res.cookie('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    expires: new Date(0),
  }).status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

// All users

router.get('/all-users', isAuthorized, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.status(200).json({
      success: true,
      users,
      total: users.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error while fetching users');
  }
});

// Update profile
router.put('/update-profile', isAuthorized, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, address, city } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.name = name || user.name;
    user.phone = phone || user.phone;
    user.address = address || user.address;
    user.city = city || user.city;

    const updatedUser = await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        phone: updatedUser.phone,
        address: updatedUser.address,
        city: updatedUser.city,
      },
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update user role (Admin only)
router.put('/update-user-role/:userId', isAuthorized, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (role === undefined || role === null) {
      return res.status(400).json({
        success: false,
        message: 'Role is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.role = role;
    const updatedUser = await user.save();

    return res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        role: updatedUser.role,
        phone: updatedUser.phone,
        address: updatedUser.address,
        city: updatedUser.city,
      },
    });
  } catch (error) {
    console.error('Update User Role Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
