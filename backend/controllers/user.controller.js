import { User } from "../models/user.model.js";

// Register/Create a new user
const registerUser = async (req, res) => {
  try {
    const { username, password, email } = req.body;

    // Validate input
    if (!username || !password || !email) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Username must be minLength: 3, maxLength: 30
    if (username.length < 3 || username.length > 30) {
      return res
        .status(400)
        .json({ message: "Username must be between 3 and 30 characters long" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long" });
    }

    if (!email.match(/^\S+@\S+\.\S+$/)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Check if username or email already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email: email.toLowerCase() }],
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create the new user
    const user = await User.create({
      username,
      password,
      email: email.toLowerCase(),
    });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// Login user
// const loginUser = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     // Validate input
//     if (!email || !password) {
//       return res
//         .status(400)
//         .json({ message: "Email and password are required" });
//     }

//     // Find the user by email
//     const user = await User.findOne({ email: email.toLowerCase() });

//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     // Check if the password is correct
//     const isMatch = await user.comparePassword(password);

//     if (!isMatch) {
//       return res.status(401).json({ message: "Invalid credentials" });
//     }

//     res.status(200).json({
//       message: "User logged in successfully",
//       user: {
//         id: user._id,
//         username: user.username,
//         email: user.email,
//       },
//     });
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: "Internal server error", error: error.message });
//   }
// };

// logout user
const logoutUser = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.logout((err) => {
      if (err) {
        return res.status(500).json({
          message: "Internal server error: Error occurred while logging out",
        });
      }

      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({
            message:
              "Internal server error: Error occurred while destroying session",
          });
        }

        res.clearCookie("connect.sid"); // Clear the session cookie

        return res.status(200).json({
          message: "User logged out successfully",
        });
      });
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// update authenticated user profile
const updateProfile = async (req, res) => {
  try {
    const { username, email, oldPassword, newPassword, confirmPassword } =
      req.body;
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!username || !email) {
      return res
        .status(400)
        .json({ message: "Username and email are required" });
    }

    if (!email.match(/^\S+@\S+\.\S+$/)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (username.length < 3 || username.length > 30) {
      return res
        .status(400)
        .json({ message: "Username must be between 3 and 30 characters" });
    }

    const existingUser = await User.findOne({
      $or: [{ username }, { email: email.toLowerCase() }],
      _id: { $ne: user._id },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Username or email is already in use" });
    }

    if (oldPassword || newPassword || confirmPassword) {
      if (!oldPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          message: "All password fields are required to change password",
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: "New passwords do not match" });
      }

      if (newPassword.length < 6) {
        return res
          .status(400)
          .json({ message: "New password must be at least 6 characters long" });
      }

      const isMatch = await user.comparePassword(oldPassword);
      if (!isMatch) {
        return res.status(401).json({ message: "Old password is incorrect" });
      }

      user.password = newPassword;
    }

    user.username = username;
    user.email = email.toLowerCase();

    await user.save();

    return res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// index route to check if user is authenticated
const index = async (req, res) => {
  if (req.isAuthenticated()) {
    return res.json({
      message: "User is authenticated",
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
      },
    });
  }
  res.status(401).json({ message: "Unauthorized" });
};

export { registerUser, logoutUser, index, updateProfile };
