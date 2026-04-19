import { setServers } from "node:dns/promises";

setServers(["1.1.1.1", "8.8.8.8"]);

import dotenv from "dotenv";
dotenv.config();

import connectDB from "./config/database.js";
import app from "./app.js";

const startServer = async () => {
  try {
    await connectDB();

    app.on("error", (error) => {
      console.error("Server error:", error);
      throw error;
    });

    app.listen(process.env.PORT || 8000, () => {
      console.log(
        `Server is running on port http://localhost:${process.env.PORT || 8000}`,
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
};

startServer();
