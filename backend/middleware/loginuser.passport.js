import passport from "passport";

const loginUser = (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);

    if (!user)
      return res.status(401).json({ message: info?.message || "Login failed" });

    req.logIn(user, (err) => {
      if (err) return next(err);

      // save login state in session
      req.session.save((err) => {
        if (err) return next(err);
      });

      return res.json({
        message: "Logged in successfully",
        user: { id: user._id, username: user.username, email: user.email },
      });
    });
  })(req, res, next);
};

export default loginUser;
