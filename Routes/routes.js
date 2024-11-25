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

// Custom middleware to check for API key
const checkApiKey = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey) {
    const user = await User.findOne({
      $or: [
        { "apiKeys.test.key": apiKey },
        { "apiKeys.production.key": apiKey },
      ],
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    req.user = user;
    req.apiKey = apiKey;
    return next();
  }

  return next();
};

router.post(
  "/watermark",
  upload.single("video"),
  checkApiKey,
  async (req, res) => {
    let inputPath = null;
    let outputPath = null;

    try {
      const { text = "Watermark" } = req.body;
      const apiKey = req.apiKey;
      const user = req.user;

      if (!req.file) {
        return res.status(400).json({ error: "No video file provided" });
      }

      // Handle usage limits
      if (!apiKey) {
        user.Demo_try_count += 1;
        if (user.Demo_try_count >= 5) {
          return res.status(403).json({ error: "Demo limit reached" });
        }
        await user.save();
      } else {
        if (user.apiKeys.test.key === apiKey) {
          user.watermark_demo_count += 1;
          if (user.watermark_demo_count >= 30) {
            return res
              .status(403)
              .json({ error: "Test key demo limit reached" });
          }
          await user.save();
        } else if (user.apiKeys.production.key === apiKey) {
          if (user.plan === "basic" && user.usage.requestCount >= 100) {
            return res
              .status(403)
              .json({ error: "Monthly limit reached for basic plan" });
          } else if (user.plan === "pro" && user.usage.requestCount >= 300) {
            return res
              .status(403)
              .json({ error: "Monthly limit reached for pro plan" });
          }
          user.usage.requestCount += 1;
          user.usage.lastRequest = new Date();
          await user.save();
        }
      }

      // Setup paths
      inputPath = path.resolve(req.file.path).replace(/\\/g, "/");
      const tempDir = path.resolve("temp");
      await fs.promises.mkdir(tempDir, { recursive: true });

      const sanitizedFileName = `watermarked_${Date.now()}_${path.basename(
        req.file.originalname
      )}`.replace(/[^a-zA-Z0-9-_.]/g, "_");
      outputPath = path.join(tempDir, sanitizedFileName).replace(/\\/g, "/");

      // Process video
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .videoFilters({
            filter: "drawtext",
            options: {
              text: text,
              fontsize: "(h/20)",
              fontcolor: "white",
              x: "(w/50)",
              y: "h-th-h/50",
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
            "-crf 23",
            "-movflags +faststart",
          ])
          .on("start", (cmdline) =>
            console.log("Started ffmpeg with command:", cmdline)
          )
          .on("progress", (progress) =>
            console.log(`Processing: ${progress.percent}% done`)
          )
          .on("error", (err) => {
            console.error("FFmpeg error:", err);
            reject(err);
          })
          .on("end", () => {
            console.log("FFmpeg processing finished");
            resolve();
          })
          .save(outputPath);
      });

      // Stream the file based on request type
      if (apiKey) {
        const stat = await fs.promises.stat(outputPath);
        res.writeHead(200, {
          "Content-Type": "video/mp4",
          "Content-Length": stat.size,
          "Content-Disposition": "inline",
          "Cache-Control": "no-cache",
          "Accept-Ranges": "bytes",
        });

        const readStream = fs.createReadStream(outputPath);

        // Handle stream errors
        readStream.on("error", (err) => {
          console.error("Stream error:", err);
          if (!res.headersSent) {
            res.status(500).json({ error: "Streaming error" });
          }
        });

        // Pipe with error handling
        readStream.pipe(res).on("error", (err) => {
          console.error("Pipe error:", err);
        });

        // Cleanup after complete
        res.on("finish", () => {
          cleanupFiles(inputPath, outputPath)
            .then(() => console.log("Cleanup completed"))
            .catch((err) => console.error("Cleanup error:", err));
        });
      } else {
        // Browser download
        return res.download(outputPath, req.file.originalname, (err) => {
          if (err) {
            console.error("Download error:", err);
          } else {
            console.log("Download started successfully");
          }
          cleanupFiles(inputPath, outputPath)
            .then(() => console.log("Cleanup completed"))
            .catch((err) => console.error("Cleanup error:", err));
        });
      }
    } catch (error) {
      console.error("Processing error:", error);
      await cleanupFiles(inputPath, outputPath);
      return res.status(500).json({
        error: "Error processing video",
        details: error.message,
      });
    }
  }
);

router.post(
  "/split-screen",
  upload.array("videos", 4),
  checkApiKey,
  async (req, res) => {
    let inputPaths = [];
    let outputPath = null;

    try {
      const { layout = "2x2" } = req.body;
      const apiKey = req.apiKey;
      const user = req.user;

      // Input validation
      if (!req.files || req.files.length < 2) {
        return res.status(400).json({
          error: "At least 2 video files required",
        });
      }

      if (layout === "2x2" && req.files.length !== 4) {
        return res.status(400).json({
          error: "2x2 layout requires exactly 4 videos",
        });
      }

      // Handle usage limits
      if (!apiKey) {
        user.Demo_try_count += 1;
        if (user.Demo_try_count >= 5) {
          return res.status(403).json({ error: "Demo limit reached" });
        }
        await user.save();
      } else {
        if (user.apiKeys.test.key === apiKey) {
          user.splitscreen_demo_count += 1;
          if (user.splitscreen_demo_count >= 30) {
            return res
              .status(403)
              .json({ error: "Test key demo limit reached" });
          }
          await user.save();
        } else if (user.apiKeys.production.key === apiKey) {
          if (user.plan === "basic" && user.usage.requestCount >= 100) {
            return res
              .status(403)
              .json({ error: "Monthly limit reached for basic plan" });
          } else if (user.plan === "pro" && user.usage.requestCount >= 300) {
            return res
              .status(403)
              .json({ error: "Monthly limit reached for pro plan" });
          }
          user.usage.requestCount += 1;
          user.usage.lastRequest = new Date();
          await user.save();
        }
      }

      // Setup paths
      const tempDir = path.resolve("temp");
      await fs.promises.mkdir(tempDir, { recursive: true });

      inputPaths = req.files.map((file) =>
        path.resolve(file.path).replace(/\\/g, "/")
      );

      const sanitizedFileName = `splitscreen_${Date.now()}.mp4`;
      outputPath = path.join(tempDir, sanitizedFileName).replace(/\\/g, "/");

      // Updated FFmpeg filters with padding and aspect ratio handling
      let filterComplex = "";
      let videoSize = "";

      switch (layout) {
        case "1x2":
          filterComplex =
            "[0:v]scale=960:540:force_original_aspect_ratio=decrease,pad=960:540:-1:-1,setsar=1[v0];" +
            "[1:v]scale=960:540:force_original_aspect_ratio=decrease,pad=960:540:-1:-1,setsar=1[v1];" +
            "[v0][v1]hstack=inputs=2";
          videoSize = "1920x540";
          break;

        case "2x1":
          filterComplex =
            "[0:v]scale=960:540:force_original_aspect_ratio=decrease,pad=960:540:-1:-1,setsar=1[v0];" +
            "[1:v]scale=960:540:force_original_aspect_ratio=decrease,pad=960:540:-1:-1,setsar=1[v1];" +
            "[v0][v1]vstack=inputs=2";
          videoSize = "960x1080";
          break;

        default: // 2x2
          filterComplex =
            "[0:v]scale=960:540:force_original_aspect_ratio=decrease,pad=960:540:-1:-1,setsar=1[v0];" +
            "[1:v]scale=960:540:force_original_aspect_ratio=decrease,pad=960:540:-1:-1,setsar=1[v1];" +
            "[2:v]scale=960:540:force_original_aspect_ratio=decrease,pad=960:540:-1:-1,setsar=1[v2];" +
            "[3:v]scale=960:540:force_original_aspect_ratio=decrease,pad=960:540:-1:-1,setsar=1[v3];" +
            "[v0][v1]hstack=inputs=2[top];" +
            "[v2][v3]hstack=inputs=2[bottom];" +
            "[top][bottom]vstack=inputs=2";
          videoSize = "1920x1080";
          break;
      }

      // Process videos with improved FFmpeg handling
      await new Promise((resolve, reject) => {
        const command = ffmpeg();

        // Validate and add input files
        inputPaths.forEach((path, index) => {
          if (!fs.existsSync(path)) {
            throw new Error(`Input file ${index + 1} not found: ${path}`);
          }
          command.input(path);
        });

        command
          .outputOptions([
            `-filter_complex ${filterComplex}`,
            "-c:v libx264",
            "-preset ultrafast",
            "-crf 23",
            "-movflags +faststart",
            `-s ${videoSize}`,
            "-y",
          ])
          .on("start", (cmdline) => {
            console.log("Started ffmpeg with command:", cmdline);
          })
          .on("stderr", (stderrLine) => {
            console.log("FFmpeg stderr:", stderrLine);
          })
          .on("error", (err) => {
            console.error("FFmpeg error:", err);
            reject(new Error(`FFmpeg processing failed: ${err.message}`));
          })
          .on("end", () => {
            console.log("FFmpeg processing finished");
            resolve();
          });

        try {
          command.save(outputPath);
        } catch (err) {
          reject(new Error(`Failed to start FFmpeg: ${err.message}`));
        }
      });

      // Stream response
      if (apiKey) {
        const stat = await fs.promises.stat(outputPath);
        res.writeHead(200, {
          "Content-Type": "video/mp4",
          "Content-Length": stat.size,
          "Content-Disposition": "inline",
          "Cache-Control": "no-cache",
          "Accept-Ranges": "bytes",
        });

        const readStream = fs.createReadStream(outputPath);

        readStream.on("error", (err) => {
          console.error("Stream error:", err);
          if (!res.headersSent) {
            res.status(500).json({ error: "Streaming error" });
          }
        });

        readStream.pipe(res).on("error", (err) => {
          console.error("Pipe error:", err);
        });

        res.on("finish", () => {
          cleanupFiles([...inputPaths, outputPath])
            .then(() => console.log("Cleanup completed"))
            .catch((err) => console.error("Cleanup error:", err));
        });
      } else {
        return res.download(outputPath, sanitizedFileName, (err) => {
          if (err) console.error("Download error:", err);
          cleanupFiles([...inputPaths, outputPath])
            .then(() => console.log("Cleanup completed"))
            .catch((err) => console.error("Cleanup error:", err));
        });
      }
    } catch (error) {
      console.error("Processing error:", error);
      await cleanupFiles([...inputPaths, outputPath]);
      return res.status(500).json({
        error: "Error processing videos",
        details: error.message,
      });
    }
  }
);

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

router.get("/Documentation", (req, res) => {
  res.render("Documentation");
});

router.get("/try", isAuth, (req, res) => {
  res.render("try");
});

export default router;
