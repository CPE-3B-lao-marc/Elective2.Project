import "./App.css";
import { Route, Routes } from "react-router-dom";
import NavBar from "./components/NavBar";
import MapPage from "./pages/MapPage";

function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<MapPage />} />
      </Routes>
    </>
  );
}

export default App;
