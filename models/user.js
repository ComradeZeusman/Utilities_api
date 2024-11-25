import mongoose from "mongoose";
import crypto from "crypto";

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
    watermark_demo_count: {
      type: Number,
      default: 0,
    },
    splitscreen_demo_count: {
      type: Number,
      default: 0,
    },
    apiKeys: {
      test: {
        key: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
      production: {
        key: {
          type: String,
          required: true,
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

// Replace pre-save with pre-validate
userSchema.pre("validate", async function (next) {
  // Generate API keys if they don't exist
  if (!this.apiKeys?.test?.key) {
    if (!this.apiKeys) this.apiKeys = {};
    if (!this.apiKeys.test) this.apiKeys.test = {};
    this.apiKeys.test.key = generateApiKey("test");
    this.apiKeys.test.createdAt = new Date();
  }

  if (!this.apiKeys?.production?.key) {
    if (!this.apiKeys.production) this.apiKeys.production = {};
    this.apiKeys.production.key = generateApiKey("prod");
    this.apiKeys.production.createdAt = new Date();
    this.apiKeys.production.enabled = this.plan !== "free";
  }

  next();
});

// Method to refresh API keys
userSchema.methods.refreshApiKeys = async function () {
  this.apiKeys.test.key = generateApiKey("test");
  this.apiKeys.test.createdAt = new Date();

  this.apiKeys.production.key = generateApiKey("prod");
  this.apiKeys.production.createdAt = new Date();
  // Maintain existing enabled status

  return this.save();
};

// Method to check if user can make API requests
userSchema.methods.canMakeRequest = function () {
  return (
    this.status === "active" &&
    this.usage.requestCount < this.usage.monthlyLimit
  );
};

// Method to increment request count
userSchema.methods.incrementRequestCount = async function () {
  this.usage.requestCount += 1;
  this.usage.lastRequest = new Date();
  return this.save();
};

// Method to reset monthly usage
userSchema.methods.resetMonthlyUsage = async function () {
  this.usage.requestCount = 0;
  return this.save();
};

// Method to upgrade plan
userSchema.methods.upgradePlan = async function (newPlan) {
  this.plan = newPlan;
  if (newPlan !== "free") {
    this.apiKeys.production.enabled = true;
  }
  return this.save();
};

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ "apiKeys.test.key": 1 }, { unique: true });
userSchema.index({ "apiKeys.production.key": 1 }, { unique: true });

const User = mongoose.model("User", userSchema);

export default User;
