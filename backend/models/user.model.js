import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minLength: 3,
      maxLength: 30,
    },

    password: { type: String, required: true, minLength: 6, maxLength: 64 },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^\S+@\S+\.\S+$/,
    },
  },
  { timestamps: true },
);

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate a token for the user
userSchema.methods.generateToken = async function () {
  // Implementation for token generation
  // You can use libraries like jsonwebtoken to create a token
  // Example:
  // const token = jwt.sign({ id: this._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  // return token;
};

export const User = mongoose.model("User", userSchema);
