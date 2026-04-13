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

export { saveLocation, deleteLocation, getLocations };
