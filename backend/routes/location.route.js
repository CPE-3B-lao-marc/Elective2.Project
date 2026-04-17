import { Router } from "express";
import isAuthenticated from "../middleware/isAuthenticated.js";
import {
  saveLocation,
  deleteLocation,
  getLocations,
  getDirections,
} from "../controllers/location.controller.js";

const router = Router();

// Directions proxy endpoint
router.route("/directions").get(getDirections);

// authenticated saved locations endpoints
router
  .route("/")
  .post(isAuthenticated, saveLocation)
  .get(isAuthenticated, getLocations);
router.route("/:id").delete(isAuthenticated, deleteLocation);

export default router;
