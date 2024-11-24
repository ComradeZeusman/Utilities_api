// auth.js
import jwt from "jsonwebtoken";
import User from "../models/user.js";

export const isAuth = async (req, res, next) => {
  try {
    // Check session authentication first
    if (req.isAuthenticated()) {
      return next();
    }

    // Check for JWT token in headers or cookies
    let token;
    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      // Handle API vs browser requests
      if (req.xhr || req.headers.accept?.includes("json")) {
        return res.status(401).json({
          status: "fail",
          error: "Please log in to access this resource",
        });
      }
      // Redirect browser requests to login
      return res.redirect("/login");
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user exists
    const user = await User.findById(decoded.id);
    if (!user) {
      if (req.xhr || req.headers.accept?.includes("json")) {
        return res.status(401).json({
          status: "fail",
          error: "User no longer exists",
        });
      }
      return res.redirect("/login");
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      if (req.xhr || req.headers.accept?.includes("json")) {
        return res.status(401).json({
          status: "fail",
          error: "Invalid token",
        });
      }
      return res.redirect("/sigin");
    }

    next(error);
  }
};

// Optional: Add role-based authorization
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: "fail",
        error: "You do not have permission to perform this action",
      });
    }
    next();
  };
};
