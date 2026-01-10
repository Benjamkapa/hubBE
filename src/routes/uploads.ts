import express from "express";
import cloudinary from "../config/cloudinary";
import { upload } from "../middleware/upload";

const router: express.Router = express.Router();

router.post(
  "/upload/service-image",
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image provided" });
      }

      const result = await cloudinary.uploader.upload(
        `data:${req.file.mimetype};base64,${req.file.buffer.toString(
          "base64"
        )}`,
        {
          folder: "services",
          transformation: [{ width: 1200, crop: "limit" }],
        }
      );

      return res.status(200).json({
        url: result.secure_url,
        public_id: result.public_id,
      });
    } catch (error) {
      console.error("Cloudinary upload error:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

export default router;
