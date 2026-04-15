import { Router } from "express";
import {
  saveLocation,
  deleteLocation,
  getLocations,
  getDirections,
} from "../controllers/location.controller.js";

const router = Router();

// Directions proxy endpoint
router.route("/directions").get(getDirections);

// toggle save and delete location
router.route("/").post(saveLocation);
router.route("/:id").delete(deleteLocation);
router.route("/").get(getLocations);

export default router;
