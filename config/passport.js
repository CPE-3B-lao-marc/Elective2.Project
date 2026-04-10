import { Strategy as LocalStrategy } from "passport-local";

import bcrypt from "bcrypt";

function initialize(passport, getUserByEmail) {
  const authenticateUser = async (email, password, done) => {
    const user = getUserByEmail(email); // Replace with your actual user retrieval logic
    if (user == null) {
      return done(null, false, { message: "No user with that email" });
    }

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

  passport.use(new LocalStrategy({ usernameField: "email" }), authenticateUser);
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  passport.deserializeUser((id, done) => {
    // Here you would typically query your database to find the user by ID
    const user = getUserById(id); // Replace with your actual user retrieval logic
    done(null, user);
  });
}

export default initialize;
