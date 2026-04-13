import { Router } from "express";
import isAuthenticated from "../middleware/isAuthenticated.js";
import isNotAuthenticated from "../middleware/isNotAuthenticated.js";
import loginUser from "../middleware/loginuser.passport.js";
import {
  registerUser,
  logoutUser,
  index,
  updateProfile,
} from "../controllers/user.controller.js";

const router = Router();

router.route("/").get(isAuthenticated, index);

router.route("/register").post(isNotAuthenticated, registerUser);

router.route("/login").post(isNotAuthenticated, loginUser);

router.route("/profile").patch(isAuthenticated, updateProfile);

router.route("/logout").post(isAuthenticated, logoutUser);

export default router;
