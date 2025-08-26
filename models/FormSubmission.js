


const mongoose = require('mongoose');

const formSubmissionSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },
        phone: {
            type: String,
            required: true,
            trim: true,
        },
        destinationCountry: {
            type: String,
            required: true,
            trim: true,
        },
        otherCountry: {
            type: String,
            trim: true,
        },
        visaType: {
            type: String,
            required: true,
            trim: true,
        },
        fromDate: {
            type: String,
            required: true,
        },
        toDate: {
            type: String,
            required: true,
        },
        purpose: {
            type: String,
            required: true,
            trim: true,
        },
        documents: [{
            fieldName: String,
            originalname: String,
            filename: String,
            mimetype: String,
            size: Number,
            cloudinaryUrl: String,
            cloudinaryPublicId: String,
            cloudinaryId: String,
            comment: String, // Add this for admin comments
        }],
        status: {
            type: String,
            enum: ['pending', 'reviewed', 'contacted', 'completed'],
            default: 'pending'
        },
        adminComments: [{
            documentId: String,
            documentName: String,
            comment: String,
            createdAt: {
                type: Date,
                default: Date.now
            }
        }],
        customerComments: [{
            message: String,
            createdAt: {
                type: Date,
                default: Date.now
            }
        }]
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('FormSubmission', formSubmissionSchema);