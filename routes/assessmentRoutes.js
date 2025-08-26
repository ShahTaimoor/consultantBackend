// routes/assessment.js
const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const FormSubmission = require('../models/FormSubmission');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for local file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDF, DOC, DOCX are allowed.'), false);
    }
  },
});

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

    // Process files
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
            cloudinaryUrl: `/uploads/${file.filename}`, // Fixed: Remove /api prefix
            cloudinaryPublicId: file.filename,
            cloudinaryId: file.filename,
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



router.put("/rename-document/:submissionId/:documentId", async (req, res) => {
  try {
    const { submissionId, documentId } = req.params;
    const { newName } = req.body; // frontend should send newName

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

    // Rename file on filesystem (uploads folder)
    const oldPath = path.join(__dirname, "../uploads", doc.filename);
    const fileExt = path.extname(doc.filename);
    const newFilename = `${newName.replace(/\s+/g, "_")}-${Date.now()}${fileExt}`;
    const newPath = path.join(__dirname, "../uploads", newFilename);

    // If file exists, rename on disk
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
    }

    // Update document fields
    doc.originalname = newName + fileExt; // new display name
    doc.filename = newFilename; // new file on disk
    doc.cloudinaryUrl = `/uploads/${newFilename}`;
    doc.cloudinaryPublicId = newFilename;
    doc.cloudinaryId = newFilename;

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

// Delete a document
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

    // Delete file from filesystem if exists
    const filePath = path.join(__dirname, "../uploads", doc.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
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
