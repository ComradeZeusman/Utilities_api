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
import jwt from "jsonwebtoken";
import passport from "passport";
import { isAuth } from "../Middleware/auth.js";
import bcrypt from "bcryptjs";
const router = express.Router();

router.get("/", (req, res) => {
  res.render("index");
});

router.get("/sigin", (req, res) => {
  res.render("siginin");
});

router.get("/watermark", isAuth, (req, res) => {
  res.render("watermark");
});

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

router.get("/dashboard", isAuth, (req, res) => {
  res.render("dashboard", { user: req.user });
});

// Sign up route
router.post("/api/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });
    // Remove password from response
    user.password = undefined;

    res.status(201).json({
      status: "success",
      data: { user },
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      error: error.message,
    });
  }
});

// Login route
router.post("/login", (req, res, next) => {
  passport.authenticate("local", async (err, user, info) => {
    if (err) {
      console.error("Login error:", err);
      return res.status(500).json({
        status: "error",
        error: "Internal server error",
      });
    }

    try {
      // Find user with password field included
      const userWithPassword = await User.findOne({
        email: req.body.email,
      }).select("+password");

      if (!userWithPassword) {
        if (req.xhr || req.headers.accept.indexOf("json") > -1) {
          return res.status(401).json({
            status: "fail",
            error: "Invalid credentials",
          });
        }
        req.flash("error", "Invalid credentials");
        return res.redirect("/login");
      }

      // Compare password with hash
      const isValidPassword = await bcrypt.compare(
        req.body.password,
        userWithPassword.password
      );

      if (!isValidPassword) {
        if (req.xhr || req.headers.accept.indexOf("json") > -1) {
          return res.status(401).json({
            status: "fail",
            error: "Invalid credentials",
          });
        }
        req.flash("error", "Invalid credentials");
        return res.redirect("/login");
      }

      // Remove password from user object
      userWithPassword.password = undefined;

      // Log in the user
      req.logIn(userWithPassword, async (err) => {
        if (err) {
          console.error("Session error:", err);
          return res.status(500).json({
            status: "error",
            error: "Login failed",
          });
        }

        // Generate JWT token
        const token = jwt.sign(
          { id: userWithPassword._id },
          process.env.JWT_SECRET,
          {
            expiresIn: process.env.JWT_EXPIRES_IN,
          }
        );

        // Set cookie for web clients
        res.cookie("jwt", token, {
          expires: new Date(
            Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
          ),
          secure: process.env.NODE_ENV === "production",
          httpOnly: true,
        });

        // Handle API vs form response
        if (req.xhr || req.headers.accept.indexOf("json") > -1) {
          return res.status(200).json({
            status: "success",
            token,
            data: { user: userWithPassword },
          });
        }

        // Redirect web clients
        return res.redirect("/dashboard");
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({
        status: "error",
        error: "Login failed",
      });
    }
  })(req, res, next);
});
export default router;
