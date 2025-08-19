const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true
        },
        password: {
            type: String,
            required: function() {
                return !this.googleId; // Password only required if not Google auth
            },
            minLength: 6,
        },
        googleId: {
            type: String,
            unique: true,
            sparse: true
        },
        avatar: {
            type: String
        },
        role: {
            type: Number,
            default: 0
        },
        address: {
            type: String
        },
        phone: {
            type: String
        },
        city: {
            type: String
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
