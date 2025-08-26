const { cloudinary } = require('../config/cloudinary');

// Middleware to handle Cloudinary uploads
const uploadToCloudinary = async (req, res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return next();
    }

    const uploadedFiles = [];

    // Process all uploaded files
    for (const fieldName in req.files) {
      const files = req.files[fieldName];
      
      for (const file of files) {
        try {
          // Upload to Cloudinary
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'visa-assessments',
            resource_type: 'auto',
          });

          uploadedFiles.push({
            fieldName,
            originalname: file.originalname,
            filename: file.filename,
            mimetype: file.mimetype,
            size: file.size,
            cloudinaryUrl: result.secure_url,
            cloudinaryPublicId: result.public_id,
            cloudinaryId: result.asset_id,
          });

        } catch (uploadError) {
          console.error('Cloudinary upload error:', uploadError);
          return res.status(500).json({
            success: false,
            message: 'Error uploading file to cloud storage',
          });
        }
      }
    }

    req.cloudinaryFiles = uploadedFiles;
    next();
  } catch (error) {
    console.error('Cloudinary middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing file uploads',
    });
  }
};

// Middleware to delete files from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    return false;
  }
};

// Middleware to get optimized image URL
const getOptimizedImageUrl = (publicId, options = {}) => {
  const defaultOptions = {
    width: 800,
    height: 600,
    crop: 'fill',
    quality: 'auto',
    format: 'auto',
  };

  const finalOptions = { ...defaultOptions, ...options };
  
  return cloudinary.url(publicId, finalOptions);
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  getOptimizedImageUrl,
};
