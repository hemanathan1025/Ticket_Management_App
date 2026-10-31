const { cloudinary, validateCloudinaryConfig } = require("../config/cloudinary");

// Upload image buffer
const uploadToCloudinary = (buffer, folder, transformation = []) => {
  validateCloudinaryConfig();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        secure: true,
        transformation,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        console.log("[cloudinary] Upload complete:", {
          folder,
          secure_url: result.secure_url,
        });
        resolve(result);
      }
    );

    stream.end(buffer);
  });
};

// Upload profile image
const uploadProfileImage = (buffer) =>
  uploadToCloudinary(buffer, "ticket-management/profiles", [
    { width: 600, height: 600, crop: "fill", gravity: "face" },
    { quality: "auto", fetch_format: "auto" },
  ]);

// Upload ticket image
const uploadTicketImage = (buffer) =>
  uploadToCloudinary(buffer, "ticket-management/tickets", [
    { quality: "auto", fetch_format: "auto" },
  ]);

// Export upload helpers
module.exports = {
  uploadProfileImage,
  uploadTicketImage,
  uploadToCloudinary,
};
