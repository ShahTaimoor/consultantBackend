// routes/assessment.js
const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const FormSubmission = require('../models/FormSubmission');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
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

// Alternative approach using pdf-lib for better PDF merging
const { PDFDocument: PDFLibDocument, rgb } = require('pdf-lib');

// Test route to verify PDF upload
router.post("/test-pdf-upload", uploadFields, async (req, res) => {
  try {
    if (!req.files) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    const documents = processFiles(req.files, 'cloudinary');
    
    // Log file details for debugging
    documents.forEach(doc => {
      console.log('File Details:', {
        originalname: doc.originalname,
        mimetype: doc.mimetype,
        cloudinaryUrl: doc.cloudinaryUrl,
        uploadType: doc.uploadType
      });
    });

    res.json({
      success: true,
      message: "PDF upload test successful",
      documents: documents,
      fileCount: documents.length
    });
  } catch (error) {
    console.error("PDF test error:", error);
    res.status(500).json({
      success: false,
      message: `Error: ${error.message || "Something went wrong"}`,
    });
  }
});

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

// Update your backend merge-pdfs endpoint to embed actual document content
router.post("/merge-pdfs", async (req, res) => {
  try {
    const { submissionId, documentIds, customerName, customerEmail, filename } = req.body;

    // Find the submission
    const submission = await FormSubmission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    // Filter documents by selected IDs
    const selectedDocuments = submission.documents.filter(doc => 
      documentIds.includes(doc._id.toString())
    );

    if (selectedDocuments.length === 0) {
      return res.status(400).json({ success: false, message: "No documents selected" });
    }

    // Create a new PDF document using pdf-lib for proper merging
    const mergedPdf = await PDFLibDocument.create();
    
    // Add a cover page with information
    const coverPage = mergedPdf.addPage([595, 842]); // A4 size
    const { width, height } = coverPage.getSize();
    
    // Add cover page content with correct color format
    coverPage.drawText('Visa Assessment Documents', {
      x: 50,
      y: height - 100,
      size: 24,
      color: rgb(0, 0, 0)
    });
    
    coverPage.drawText(`Customer: ${customerName}`, {
      x: 50,
      y: height - 150,
      size: 14,
      color: rgb(0, 0, 0)
    });
    
    coverPage.drawText(`Email: ${customerEmail}`, {
      x: 50,
      y: height - 170,
      size: 14,
      color: rgb(0, 0, 0)
    });
    
    coverPage.drawText(`Date: ${new Date().toLocaleDateString()}`, {
      x: 50,
      y: height - 190,
      size: 14,
      color: rgb(0, 0, 0)
    });

    // Process each document and embed its actual content
    for (let i = 0; i < selectedDocuments.length; i++) {
      const document = selectedDocuments[i];
      
      try {
        // Download the document from Cloudinary
        if (document.cloudinaryUrl) {
          const response = await axios.get(document.cloudinaryUrl, {
            responseType: 'arraybuffer'
          });

          if (document.mimetype === 'application/pdf') {
            // For PDFs, embed the actual PDF content
            const pdfBytes = response.data;
            const pdfDoc = await PDFLibDocument.load(pdfBytes);
            const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
            
            // Add each page from the PDF
            pages.forEach(page => {
              mergedPdf.addPage(page);
            });
            
          } else if (document.mimetype.startsWith('image/')) {
            // For images, create a new page and embed the image
            const imagePage = mergedPdf.addPage([595, 842]);
            const { width, height } = imagePage.getSize();
            
            // Embed the image
            const imageBytes = response.data;
            let image;
            
            if (document.mimetype === 'image/jpeg' || document.mimetype === 'image/jpg') {
              image = await mergedPdf.embedJpg(imageBytes);
            } else if (document.mimetype === 'image/png') {
              image = await mergedPdf.embedPng(imageBytes);
            } else {
              // For other image types, try to embed as PNG
              image = await mergedPdf.embedPng(imageBytes);
            }
            
            // Calculate image dimensions to fit on page
            const imgDims = image.scale(1);
            const scale = Math.min((width - 100) / imgDims.width, (height - 150) / imgDims.height);
            const scaledWidth = imgDims.width * scale;
            const scaledHeight = imgDims.height * scale;
            
            // Center the image
            const x = (width - scaledWidth) / 2;
            const y = height - 100 - scaledHeight;
            
            // Add image title with correct color format
            imagePage.drawText(`Document ${i + 1}: ${document.fieldName}`, {
              x: 50,
              y: height - 50,
              size: 16,
              color: rgb(0, 0, 0)
            });
            
            imagePage.drawText(`File: ${document.originalname}`, {
              x: 50,
              y: height - 70,
              size: 12,
              color: rgb(0.5, 0.5, 0.5)
            });
            
            // Draw the image
            imagePage.drawImage(image, {
              x: x,
              y: y,
              width: scaledWidth,
              height: scaledHeight
            });
            
          } else {
            // For other file types, create a placeholder page
            const placeholderPage = mergedPdf.addPage([595, 842]);
            const { width, height } = placeholderPage.getSize();
            
            placeholderPage.drawText(`Document ${i + 1}: ${document.fieldName}`, {
              x: 50,
              y: height - 100,
              size: 16,
              color: rgb(0, 0, 0)
            });
            
            placeholderPage.drawText(`File: ${document.originalname}`, {
              x: 50,
              y: height - 130,
              size: 14,
              color: rgb(0, 0, 0)
            });
            
            placeholderPage.drawText(`Type: ${document.mimetype}`, {
              x: 50,
              y: height - 150,
              size: 14,
              color: rgb(0, 0, 0)
            });
            
            placeholderPage.drawText(`Size: ${(document.size / 1024 / 1024).toFixed(2)} MB`, {
              x: 50,
              y: height - 170,
              size: 14,
              color: rgb(0, 0, 0)
            });
            
            placeholderPage.drawText('This document has been included in the merged PDF.', {
              x: 50,
              y: height - 200,
              size: 12,
              color: rgb(0.5, 0.5, 0.5)
            });
          }
        } else {
          // No URL available - create placeholder page
          const placeholderPage = mergedPdf.addPage([595, 842]);
          const { width, height } = placeholderPage.getSize();
          
          placeholderPage.drawText(`Document ${i + 1}: ${document.fieldName}`, {
            x: 50,
            y: height - 100,
            size: 16,
            color: rgb(0, 0, 0)
          });
          
          placeholderPage.drawText(`File: ${document.originalname}`, {
            x: 50,
            y: height - 130,
            size: 14,
            color: rgb(0, 0, 0)
          });
          
          placeholderPage.drawText('Document not available for embedding.', {
            x: 50,
            y: height - 160,
            size: 12,
            color: rgb(0.8, 0.2, 0.2)
          });
        }
      } catch (error) {
        console.error(`Error embedding document ${document.originalname}:`, error);
        
        // Create error page
        const errorPage = mergedPdf.addPage([595, 842]);
        const { width, height } = errorPage.getSize();
        
        errorPage.drawText(`Document ${i + 1}: ${document.fieldName}`, {
          x: 50,
          y: height - 100,
          size: 16,
          color: rgb(0, 0, 0)
        });
        
        errorPage.drawText(`Error embedding document: ${document.originalname}`, {
          x: 50,
          y: height - 130,
          size: 14,
          color: rgb(0.8, 0.2, 0.2)
        });
        
        errorPage.drawText('Document could not be embedded due to an error.', {
          x: 50,
          y: height - 150,
          size: 12,
          color: rgb(0.5, 0.5, 0.5)
        });
      }
    }

    // Add footer to the last page
    const pages = mergedPdf.getPages();
    if (pages.length > 0) {
      const lastPage = pages[pages.length - 1];
      const { width, height } = lastPage.getSize();
      
      lastPage.drawText('Generated by Wise Steps Consultant', {
        x: 50,
        y: 50,
        size: 10,
        color: rgb(0.5, 0.5, 0.5)
      });
      
      lastPage.drawText(`Generated on: ${new Date().toISOString()}`, {
        x: 50,
        y: 30,
        size: 8,
        color: rgb(0.5, 0.5, 0.5)
      });
    }

    // Save the merged PDF
    const safeFilename = (filename || customerName || 'merged_documents').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${safeFilename}_${Date.now()}.pdf`;
    const filePath = path.join(__dirname, '../uploads', fileName);
    
    const mergedPdfBytes = await mergedPdf.save();
    fs.writeFileSync(filePath, mergedPdfBytes);

    // Set proper headers for download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Send the file
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error sending file:', err);
      }
      // Clean up the temporary file
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error('Error deleting temporary file:', unlinkErr);
        }
      });
    });

  } catch (error) {
    console.error("PDF merge error:", error);
    res.status(500).json({
      success: false,
      message: `Error: ${error.message || "Something went wrong"}`,
    });
  }
});

module.exports = router;
