import { Location } from "../models/location.model.js";

// save a new location
const saveLocation = async (req, res) => {
  try {
    const { name, address, latitude, longitude } = req.body;

    const location = new Location({
      name,
      address,
      latitude,
      longitude,
    });

    await location.save();

    res.status(201).json({
      message: "Location saved successfully",
      location,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// delete a location by ID
const deleteLocation = async (req, res) => {
  try {
    const { id } = req.params;

    const location = await Location.findByIdAndDelete(id);

    if (!location) {
      return res.status(404).json({ message: "Location not found" });
    }

    res.status(200).json({
      message: "Location deleted successfully",
      location,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// view all saved locations
const getLocations = async (req, res) => {
  try {
    const locations = await Location.find();
    res.status(200).json({ locations });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

// fetch directions from Google Maps API through the backend proxy
const getDirections = async (req, res) => {
  try {
    const { origin, destination, mode } = req.query;

    if (!origin || !destination || !mode) {
      return res.status(400).json({
        message: "origin, destination, and mode are required",
      });
    }

    const googleKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleKey) {
      return res
        .status(500)
        .json({ message: "Google Maps API key is not configured." });
    }

    const params = new URLSearchParams({
      origin,
      destination,
      mode,
      key: googleKey,
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`,
    );
    const data = await response.json();

    if (data.status !== "OK" || !data.routes?.length) {
      return res.status(502).json({
        message: data.error_message || "Unable to get directions from Google.",
        status: data.status,
        details: data,
      });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({
      message: error.message || "Internal server error",
      error: error.message,
    });
  }
};

export { saveLocation, deleteLocation, getLocations, getDirections };
