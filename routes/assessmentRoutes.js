// routes/assessment.js
const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const FormSubmission = require('../models/FormSubmission');
const { 
  uploadFields, 
  uploadFieldsLocal, 
  processFiles,
  uploadLocalToCloudinary 
} = require('../config/cloudinary');
const { 
  deleteFromCloudinary, 
  deleteLocalFile, 
  convertLocalToCloudinary,
  cleanupFiles 
} = require('../middleware/cloudinaryMiddleware');

// Route handler for Cloudinary upload
router.post("/submit-assessment", uploadFields, async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      destinationCountry,
      otherCountry,
      visaType,
      fromDate,
      toDate,
      purpose,
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !destinationCountry || !visaType || !fromDate || !toDate || !purpose) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    // Process files from Cloudinary
    const documents = processFiles(req.files, 'cloudinary');

    // Save form submission to database
    const formSubmission = await FormSubmission.create({
      name,
      email,
      phone,
      destinationCountry,
      otherCountry,
      visaType,
      fromDate,
      toDate,
      purpose,
      documents,
      status: 'pending'
    });

    res.json({
      success: true,
      message: "Assessment submitted successfully! We will contact you within 24 hours.",
      submissionId: formSubmission._id
    });
  } catch (error) {
    console.error("Assessment error:", error);
    res.status(500).json({
      success: false,
      message: `Error: ${error.message || "Something went wrong"}`,
    });
  }
});

// Route handler for local upload
router.post("/submit-assessment-local", uploadFieldsLocal, async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      destinationCountry,
      otherCountry,
      visaType,
      fromDate,
      toDate,
      purpose,
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !destinationCountry || !visaType || !fromDate || !toDate || !purpose) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    // Process files for local storage
    const documents = processFiles(req.files, 'local');

    // Save form submission to database
    const formSubmission = await FormSubmission.create({
      name,
      email,
      phone,
      destinationCountry,
      otherCountry,
      visaType,
      fromDate,
      toDate,
      purpose,
      documents,
      status: 'pending'
    });

    res.json({
      success: true,
      message: "Assessment submitted successfully! We will contact you within 24 hours.",
      submissionId: formSubmission._id
    });
  } catch (error) {
    console.error("Assessment error:", error);
    res.status(500).json({
      success: false,
      message: `Error: ${error.message || "Something went wrong"}`,
    });
  }
});

// Route to convert local files to Cloudinary
router.post("/convert-to-cloudinary/:submissionId", async (req, res) => {
  try {
    const { submissionId } = req.params;

    const submission = await FormSubmission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    // Convert local files to Cloudinary
    const convertedDocuments = await convertLocalToCloudinary(submission.documents);
    
    // Update submission with converted documents
    submission.documents = convertedDocuments;
    await submission.save();

    res.json({
      success: true,
      message: "Files converted to Cloudinary successfully",
      submission
    });
  } catch (error) {
    console.error("Conversion error:", error);
    res.status(500).json({
      success: false,
      message: `Error: ${error.message || "Something went wrong"}`,
    });
  }
});

// Rename document in Cloudinary
router.put("/rename-document/:submissionId/:documentId", async (req, res) => {
  try {
    const { submissionId, documentId } = req.params;
    const { newName } = req.body;

    if (!newName || !newName.trim()) {
      return res.status(400).json({ success: false, message: "New name is required" });
    }

    // Find submission
    const submission = await FormSubmission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    // Find document
    const docIndex = submission.documents.findIndex(
      (doc) => doc._id.toString() === documentId
    );
    if (docIndex === -1) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    const doc = submission.documents[docIndex];

    // Update document fields (Cloudinary URLs remain the same)
    doc.originalname = newName + (doc.originalname.includes('.') ? doc.originalname.substring(doc.originalname.lastIndexOf('.')) : '');
    
    await submission.save();

    res.json({
      success: true,
      message: "Document renamed successfully",
      document: doc,
    });
  } catch (error) {
    console.error("Rename error:", error);
    res.status(500).json({
      success: false,
      message: `Error: ${error.message || "Something went wrong"}`,
    });
  }
});

// Delete a document from Cloudinary or local storage
router.delete("/delete-document/:submissionId/:documentId", async (req, res) => {
  try {
    const { submissionId, documentId } = req.params;

    // Find submission
    const submission = await FormSubmission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    // Find document
    const docIndex = submission.documents.findIndex(
      (doc) => doc._id.toString() === documentId
    );
    if (docIndex === -1) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    const doc = submission.documents[docIndex];

    // Delete from Cloudinary if public ID exists
    if (doc.uploadType === 'cloudinary' && doc.cloudinaryPublicId) {
      await deleteFromCloudinary(doc.cloudinaryPublicId);
    } else if (doc.uploadType === 'local' && doc.localPath) {
      // Delete local file
      await deleteLocalFile(doc.localPath);
    }

    // Remove document from array
    submission.documents.splice(docIndex, 1);
    await submission.save();

    res.json({
      success: true,
      message: "Document deleted successfully",
      documentId,
    });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({
      success: false,
      message: `Error: ${error.message || "Something went wrong"}`,
    });
  }
});

// Get submission with file URLs (works for both local and cloudinary)
router.get("/submission/:submissionId", async (req, res) => {
  try {
    const { submissionId } = req.params;

    const submission = await FormSubmission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    // Add file URLs to documents
    const documentsWithUrls = submission.documents.map(doc => {
      const docObj = doc.toObject();
      if (doc.uploadType === 'cloudinary' && doc.cloudinaryUrl) {
        docObj.fileUrl = doc.cloudinaryUrl;
      } else if (doc.uploadType === 'local' && doc.localPath) {
        docObj.fileUrl = `/uploads/${doc.filename}`;
      }
      return docObj;
    });

    const submissionWithUrls = {
      ...submission.toObject(),
      documents: documentsWithUrls
    };

    res.json({
      success: true,
      submission: submissionWithUrls
    });
  } catch (error) {
    console.error("Get submission error:", error);
    res.status(500).json({
      success: false,
      message: `Error: ${error.message || "Something went wrong"}`,
    });
  }
});

module.exports = router;
