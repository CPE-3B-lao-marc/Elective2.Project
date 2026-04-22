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

const isProd = process.env.NODE_ENV === "production";

const app = express();

initializePassport(passport);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS configuration, update the origin to match your frontend URL and port after deployment,
// actual domain will be used instead of localhost
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));

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
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

// use it in production
// const indexPath = path.join(__dirname, "./frontend/dist");

const indexPath = path.join(__dirname, "../frontend/dist");

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
