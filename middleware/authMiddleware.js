const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middlewar to check if user is authorize
const isAuthorized = async (req, res, next) => {
    try {
        const { token } = req.cookies;

        if (!token) {
            return res.status(401).json({ success: false, message: 'Please log in first.' });
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decodedToken.id);
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found.' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Error in isAuthorized middleware:', error.message);
        return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    try {
        const { user } = req;

        if (!user) {
            return res.status(401).json({ success: false, message: 'User not authenticated.' });
        }

        if (user.role !== 1) {
            return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
        }

        next();
    } catch (error) {
        console.error('Error in isAdmin middleware:', error.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

module.exports = {
    isAuthorized,
    isAdmin,
};
