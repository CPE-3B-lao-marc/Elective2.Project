import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import passport from "passport";
import { User } from "./models/user.model.js";

// import initializePassport from "./config/passport.js";

// initializePassport(passport, async (email) => {
//   return await User.findOne({ email: email.toLowerCase() });
// });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("view-engine", "ejs");
app.use(express.json());

const indexPath = path.join(__dirname, "/public");
app.use(express.static(indexPath));

// Routes import
import userRouter from "./routes/user.route.js";
import locationRouter from "./routes/location.route.js";

// Routes declaration
app.use("/api/users", userRouter);
app.use("/api/locations", locationRouter);

// Serve index.html for all non-API routes
app.use((req, res) => {
  res.sendFile(path.join(indexPath, "index.html"));
});

export default app;
