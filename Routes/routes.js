import express from "express";
import { upload } from "../Middleware/multer.js";
import ffmpeg from "fluent-ffmpeg";
import bodyParser from "body-parser";
import API_KEY from "../Middleware/API_KEY.js";
import fs from "fs";
import path from "path";
import User from "../models/user.js";
import Ffmpeg from "fluent-ffmpeg";
import { rootCertificates } from "tls";
const router = express.Router();

router.get("/", (req, res) => {
  res.render("index");
});

router.get("/watermark", (req, res) => {
  res.render("watermark");
});
// Video watermark route
router.post("/watermark", upload.single("video"), async (req, res) => {
  try {
    const { text = "Watermark" } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: "No video file provided" });
    }

    const inputPath = req.file.path;
    const originalName = req.file.originalname;
    const outputPath = path.join(
      "temp",
      `watermarked_${Date.now()}_${originalName}`
    );

    // Ensure temp directory exists
    if (!fs.existsSync("temp")) {
      fs.mkdirSync("temp");
    }

    // Add watermark using ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters({
          filter: "drawtext",
          options: {
            text: text,
            fontsize: 36,
            fontcolor: "white",
            x: "10", // 10 pixels from left
            y: "h-th-10", // 10 pixels from bottom
            shadowcolor: "black",
            shadowx: 2,
            shadowy: 2,
            box: 1, // Add background box
            boxcolor: "black@0.4", // Semi-transparent background
            boxborderw: 5, // Box padding
          },
        })
        .outputOptions([
          "-c:v copy", // Copy video codec
          "-c:a copy", // Copy audio codec
          "-movflags +faststart", // Optimize for web playback
        ])
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    // Send processed file with original name
    res.download(outputPath, originalName, (err) => {
      // Cleanup after sending
      try {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch (cleanupError) {
        console.error("Cleanup error:", cleanupError);
      }
    });
  } catch (error) {
    console.error(error);
    // Cleanup on error
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    } catch (cleanupError) {
      console.error("Cleanup error:", cleanupError);
    }
    res.status(500).json({ error: "Error processing video" });
  }
});
export default router;
