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
// Helper function for cleanup
const cleanupFiles = async (inputPath, outputPath) => {
  try {
    if (inputPath && fs.existsSync(inputPath)) {
      await fs.promises.unlink(inputPath);
    }
    if (outputPath && fs.existsSync(outputPath)) {
      await fs.promises.unlink(outputPath);
    }
  } catch (err) {
    console.error("Cleanup error:", err);
  }
};

// Helper function to sanitize path
function sanitizePath(filePath) {
  return filePath.replace(/[^a-zA-Z0-9-_/.]/g, "_").replace(/\s+/g, "_");
}

router.post("/watermark", upload.single("video"), async (req, res) => {
  let inputPath = null;
  let outputPath = null;

  try {
    const { text = "Watermark" } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: "No video file provided" });
    }

    inputPath = path.resolve(req.file.path).replace(/\\/g, "/");
    const tempDir = path.resolve("temp");
    await fs.promises.mkdir(tempDir, { recursive: true });

    const sanitizedFileName = `watermarked_${Date.now()}_${path.basename(
      req.file.originalname
    )}`.replace(/[^a-zA-Z0-9-_.]/g, "_");
    outputPath = path.join(tempDir, sanitizedFileName).replace(/\\/g, "/");

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters({
          filter: "drawtext",
          options: {
            text: text,
            fontsize: "(h/20)", // Dynamic font size based on video height
            fontcolor: "white",
            x: "(w/50)", // 2% from left edge
            y: "h-th-h/50", // Bottom with 2% padding
            shadowcolor: "black",
            shadowx: 2,
            shadowy: 2,
            box: 1,
            boxcolor: "black@0.5",
            boxborderw: 5,
            font: "Arial",
          },
        })
        .outputOptions([
          "-vcodec libx264",
          "-acodec copy",
          "-preset ultrafast",
          "-crf 23", // Maintain good quality
          "-movflags +faststart",
        ])
        .on("start", (cmdline) => {
          console.log("Started ffmpeg with command:", cmdline);
        })
        .on("progress", (progress) => {
          console.log(`Processing: ${progress.percent}% done`);
        })
        .on("error", (err) => {
          console.error("FFmpeg error:", err);
          reject(err);
        })
        .on("end", () => resolve())
        .save(outputPath);
    });

    return res.download(outputPath, req.file.originalname, (err) => {
      if (err) console.error("Download error:", err);
      cleanupFiles(inputPath, outputPath);
    });
  } catch (error) {
    console.error("Processing error:", error);
    await cleanupFiles(inputPath, outputPath);
    return res.status(500).json({
      error: "Error processing video",
      details: error.message,
    });
  }
});
export default router;
