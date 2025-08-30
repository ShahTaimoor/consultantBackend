// routes/assessment.js
const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const FormSubmission = require('../models/FormSubmission');
const { upload } = require('../config/cloudinary');
const { deleteFromCloudinary } = require('../middleware/cloudinaryMiddleware');

// Configure upload fields for Cloudinary
const uploadFields = upload.fields([
  { name: "passports" },
  { name: "businessBankStatement" },
  { name: "personalBankStatement" },
  { name: "businessRegistration" },
  { name: "taxpayerCertificate" },
  { name: "incomeTaxReturns" },
  { name: "propertyDocuments" },
  { name: "frcFamily" },
  { name: "frcParents" },
  { name: "marriageCertificate" },
  { name: "invitationLetter" },
  { name: "flightReservation" },
  { name: "hotelReservation" },
  { name: "anyOtherDocuments" },
  { name: "coverLetter" },
]);

// Route handler
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
    const documents = [];
    if (req.files) {
      Object.keys(req.files).forEach((fieldName) => {
        req.files[fieldName].forEach((file) => {
          documents.push({
            fieldName,
            originalname: file.originalname,
            filename: file.filename,
            mimetype: file.mimetype,
            size: file.size,
            cloudinaryUrl: file.path, // Cloudinary URL
            cloudinaryPublicId: file.filename, // Cloudinary public ID
            cloudinaryId: file.filename, // Cloudinary asset ID
          });
        });
      });
    }

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

// Delete a document from Cloudinary
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
    if (doc.cloudinaryPublicId) {
      await deleteFromCloudinary(doc.cloudinaryPublicId);
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

module.exports = router;
