import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import flash from "express-flash";
import session from "express-session";
import passport from "passport";
import initializePassport from "./config/passport.js";
import dotenv from "dotenv";
dotenv.config();

initializePassport(passport);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS configuration, update the origin to match your frontend URL and port after deployment,
// actual domain will be used instead of localhost
app.use(
  cors({ origin: "http://localhost:5173", credentials: true }),
);

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(flash());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      sameSite: "none",
      secure: false,
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

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
