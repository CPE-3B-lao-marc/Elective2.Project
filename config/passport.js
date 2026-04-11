import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { User } from "../models/user.model.js";

function initialize(passport) {
  const getUserByEmail = async (email) => {
    return await User.findOne({ email: email.toLowerCase() });
  };

  const getUserById = async (id) => {
    return await User.findById(id);
  };

  const authenticateUser = async (email, password, done) => {
    // Validate input
    if (!email || !password) {
      return done(null, false, {
        message: "Please enter both email and password",
      });
    }

    // Find the user by email
    const user = await getUserByEmail(email);
    if (user == null) {
      return done(null, false, { message: "No user with that email" });
    }

    // Compare the provided password with the stored hashed password
    try {
      if (await bcrypt.compare(password, user.password)) {
        return done(null, user);
      } else {
        return done(null, false, { message: "Password incorrect" });
      }
    } catch (error) {
      return done(error);
    }
  };

  passport.use(new LocalStrategy({ usernameField: "email" }, authenticateUser));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  passport.deserializeUser(async (id, done) => {
    // Here you would typically query your database to find the user by ID
    const user = await getUserById(id); // Replace with your actual user retrieval logic
    return done(null, user);
  });
}

export default initialize;
