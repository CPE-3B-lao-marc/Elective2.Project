import { Router } from "express";
import {
  saveLocation,
  deleteLocation,
  getLocations,
} from "../controllers/location.controller.js";

const router = Router();

// toggle save and delete location
router.route("/").post(saveLocation);
router.route("/:id").delete(deleteLocation);
router.route("/").get(getLocations);

export default router;
