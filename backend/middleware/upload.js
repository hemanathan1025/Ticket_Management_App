// Import upload tools
const multer = require("multer");

// Accept image files
const imageFileFilter = (req, file, callback) => {
  if (file.mimetype?.startsWith("image/")) {
    callback(null, true);
    return;
  }

  callback(new Error("Only image files are allowed"));
};

// Store uploads in memory
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
});

// Upload one image
const uploadImage = (fieldName = "image") => (req, res, next) => {
  upload.single(fieldName)(req, res, (error) => {
    if (!error) {
      console.log("[upload] Received image:", req.file
        ? {
            fieldName: req.file.fieldname,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
          }
        : null);
      next();
      return;
    }

    res.status(400).json({
      success: false,
      message: error.message || "Image upload failed",
    });
  });
};

// Upload multiple images
const uploadImages = (fieldName = "images", maxCount = 5) => (req, res, next) => {
  upload.array(fieldName, maxCount)(req, res, (error) => {
    if (!error) {
      console.log("[upload] Received images:", (req.files || []).map((file) => ({
        fieldName: file.fieldname,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      })));
      next();
      return;
    }

    res.status(400).json({
      success: false,
      message: error.message || "Image upload failed",
    });
  });
};

// Export upload middleware
module.exports = { upload, uploadImage, uploadImages };
