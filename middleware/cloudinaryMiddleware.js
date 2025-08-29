const { cloudinary } = require('../config/cloudinary');

// Middleware to delete files from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log('File deleted from Cloudinary:', result);
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

// Middleware to get thumbnail URL
const getThumbnailUrl = (publicId, width = 150, height = 150) => {
  return cloudinary.url(publicId, {
    width,
    height,
    crop: 'fill',
    quality: 'auto',
    format: 'auto',
  });
};

// Middleware to upload single file to Cloudinary
const uploadSingleToCloudinary = async (file, folder = 'visa-assessments') => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: folder,
      resource_type: 'auto',
      transformation: [
        { 
          width: 1000, 
          height: 1000, 
          crop: 'limit',
          quality: 'auto',
          fetch_format: 'auto'
        }
      ],
    });
    return result;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};

module.exports = {
  deleteFromCloudinary,
  getOptimizedImageUrl,
  getThumbnailUrl,
  uploadSingleToCloudinary,
};
