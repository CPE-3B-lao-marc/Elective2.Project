import "./App.css";
import { Route, Routes } from "react-router-dom";
import NavBar from "./components/NavBar";

function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<div>Hello, World!</div>} />
      </Routes>
    </>
  );
}

export default App;
