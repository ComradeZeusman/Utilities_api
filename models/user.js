import mongoose from "mongoose";
import crypto from "crypto";

// Helper function to generate API key
function generateApiKey(prefix) {
  const randomBytes = crypto.randomBytes(16).toString("hex");
  return `${prefix}_${randomBytes}`;
}

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    Demo_try_count: {
      type: Number,
      default: 0,
    },
    Demo_reset_count: {
      type: Number,
      default: 0,
    },
    apiKeys: {
      test: {
        key: {
          type: String,
          unique: true,
          sparse: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
      production: {
        key: {
          type: String,
          unique: true,
          sparse: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        enabled: {
          type: Boolean,
          default: false,
        },
      },
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    plan: {
      type: String,
      enum: ["free", "basic", "pro"],
      default: "free",
    },
    usage: {
      requestCount: {
        type: Number,
        default: 0,
      },
      lastRequest: {
        type: Date,
      },
      monthlyLimit: {
        type: Number,
        default: 100,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Generate API keys before saving new user
userSchema.pre("save", async function (next) {
  if (this.isNew) {
    // Generate test key for all users
    this.apiKeys = {
      test: {
        key: generateApiKey("test"),
        createdAt: new Date(),
      },
      production: {
        key: null,
        enabled: false,
      },
    };

    // Generate production key for paid plans
    if (this.plan !== "free") {
      this.apiKeys.production = {
        key: generateApiKey("prod"),
        createdAt: new Date(),
        enabled: true,
      };
    }
  }
  next();
});

// Method to refresh API keys
userSchema.methods.refreshApiKeys = async function () {
  this.apiKeys.test.key = generateApiKey("test");
  this.apiKeys.test.createdAt = new Date();

  if (this.plan !== "free") {
    this.apiKeys.production.key = generateApiKey("prod");
    this.apiKeys.production.createdAt = new Date();
  }

  return this.save();
};

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ "apiKeys.test.key": 1 });
userSchema.index({ "apiKeys.production.key": 1 });

const User = mongoose.model("User", userSchema);

export default User;
