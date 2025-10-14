import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadOnCloudinary = async (
  localFilePath: string
): Promise<{ url: string } | null> => {
  try {
    if (!localFilePath) return null;

    // Upload the file to cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    // Remove the locally saved temp file
    fs.unlinkSync(localFilePath);

    console.log("Image uploaded on cloudinary:", response.url);
    return { url: response.url };
  } catch (error) {
    // Remove the locally saved temp file in case of upload failure
    fs.unlinkSync(localFilePath);
    console.error("Error uploading to cloudinary:", error);
    return null;
  }
};
