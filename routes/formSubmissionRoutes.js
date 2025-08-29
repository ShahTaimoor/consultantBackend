


const express = require('express');
const router = express.Router();
const FormSubmission = require('../models/FormSubmission');
const nodemailer = require('nodemailer');
const { deleteFromCloudinary } = require('../middleware/cloudinaryMiddleware');

// Get all form submissions
router.get('/form-submissions', async (req, res) => {
  try {
    const submissions = await FormSubmission.find().sort({ createdAt: -1 });
    res.json({ success: true, submissions });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ success: false, message: 'Error fetching submissions' });
  }
});

// Update submission status
router.put('/form-submissions/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const submission = await FormSubmission.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    res.json({ success: true, submission });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ success: false, message: 'Error updating status' });
  }
});

// Add comment to a specific document and send email
router.put('/:submissionId/documents/:documentId/comment', async (req, res) => {
  try {
    const { submissionId, documentId } = req.params;
    const { comment } = req.body;

    const submission = await FormSubmission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    // Find and update the specific document
    const document = submission.documents.id(documentId);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Update document comment
    document.comment = comment;

    // Add to admin comments array
    submission.adminComments.push({
      documentId: documentId,
      documentName: document.originalname,
      comment: comment,
      createdAt: new Date()
    });

    await submission.save();

    // Send email to customer
    await sendCommentEmail(submission, document, comment);

    res.json({ success: true, message: 'Comment saved and email sent successfully' });
  } catch (error) {
    console.error('Error saving comment:', error);
    res.status(500).json({ success: false, message: 'Error saving comment' });
  }
});

// Add customer comment
router.post('/:submissionId/customer-comment', async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { message } = req.body;

    const submission = await FormSubmission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    submission.customerComments.push({
      message: message,
      createdAt: new Date()
    });

    await submission.save();

    res.json({ success: true, message: 'Comment added successfully' });
  } catch (error) {
    console.error('Error adding customer comment:', error);
    res.status(500).json({ success: false, message: 'Error adding comment' });
  }
});

// Get customer submission
router.get('/customer-submission/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const submission = await FormSubmission.findOne({ email }).sort({ createdAt: -1 });
    
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    res.json({ success: true, submission });
  } catch (error) {
    console.error('Error fetching customer submission:', error);
    res.status(500).json({ success: false, message: 'Error fetching submission' });
  }
});

// Delete submission and all associated files from Cloudinary
router.delete('/form-submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const submission = await FormSubmission.findById(id);
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    // Delete all files from Cloudinary
    if (submission.documents && submission.documents.length > 0) {
      for (const doc of submission.documents) {
        if (doc.cloudinaryPublicId) {
          await deleteFromCloudinary(doc.cloudinaryPublicId);
        }
      }
    }

    // Delete submission from database
    await FormSubmission.findByIdAndDelete(id);

    res.json({ success: true, message: 'Submission deleted successfully' });
  } catch (error) {
    console.error('Error deleting submission:', error);
    res.status(500).json({ success: false, message: 'Error deleting submission' });
  }
});

// Email function
async function sendCommentEmail(submission, document, comment) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: submission.email,
      subject: `Document Review Update - ${submission.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Document Review Update</h2>
          <p>Dear ${submission.name},</p>
          <p>Your visa assessment application has been reviewed. Here's an update:</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #374151; margin-top: 0;">Document: ${document.originalname}</h3>
            <p style="color: #6b7280; margin-bottom: 10px;"><strong>Admin Comment:</strong></p>
            <p style="background-color: white; padding: 15px; border-radius: 6px; border-left: 4px solid #2563eb;">
              ${comment}
            </p>
          </div>
          
          <p>You can view all updates and comments on your application dashboard.</p>
          
          <div style="background-color: #dbeafe; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; color: #1e40af;">
              <strong>Application Details:</strong><br>
              Destination: ${submission.destinationCountry}<br>
              Visa Type: ${submission.visaType}<br>
              Status: ${submission.status}
            </p>
          </div>
          
          <p>If you have any questions, please don't hesitate to contact us.</p>
          
          <p>Best regards,<br>Visa Assessment Team</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Comment email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

module.exports = router;