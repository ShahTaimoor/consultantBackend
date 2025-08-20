// routes/assessment.js
const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const multer = require("multer");

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/msword", // .doc
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
      "image/jpeg",
      "image/jpg",
      "image/pjpeg", // sometimes browsers send this
      "image/png",
      "image/webp", // ✅ allow .webp
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.error("❌ Blocked file type:", file.originalname, file.mimetype);
      cb(
        new Error(
          "Invalid file type. Only PDF, DOC, DOCX, JPG, PNG, WEBP are allowed."
        ),
        false
      );
    }
  },
});

// ✅ Accept multiple named file fields
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

// Nodemailer transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

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

    // Validate required
    if (!name || !email || !destinationCountry || !visaType || !fromDate || !toDate || !purpose) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be filled.",
      });
    }

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({
        success: false,
        message:
          "Assessment service not configured. Missing EMAIL_USER / EMAIL_PASS.",
      });
    }

    const transporter = createTransporter();
    const finalCountry =
      destinationCountry === "Other" ? otherCountry : destinationCountry;

    // Flatten files
    const files = [];
    Object.keys(req.files || {}).forEach((field) => {
      req.files[field].forEach((file) => files.push(file));
    });

    // Email body
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: `🎯 New Visa Assessment Request: ${name}`,
      html: `
        <h2>🎯 New Visa Assessment Request</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || "Not provided"}</p>
        <p><strong>Destination:</strong> ${finalCountry}</p>
        <p><strong>Visa Type:</strong> ${visaType}</p>
        <p><strong>Travel Dates:</strong> ${fromDate} → ${toDate}</p>
        <p><strong>Purpose:</strong> ${purpose}</p>
        <hr>
        <p>📌 Please contact applicant within 24 hours.</p>
      `,
      attachments: files.map((file) => ({
        filename: file.originalname,
        content: file.buffer,
        contentType: file.mimetype,
      })),
    };

    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message:
        "Assessment submitted successfully! We will contact you within 24 hours.",
    });
  } catch (error) {
    console.error("Assessment error:", error);
    res.status(500).json({
      success: false,
      message: `Error: ${error.message || "Something went wrong"}`,
    });
  }
});

module.exports = router;
