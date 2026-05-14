import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Analytics from "./Analytics/analytics";
import Profile from "./Profile/profile";
import Assign from "./Assign/assign";
import Dashboard from "./Dashboard/Dashboard";
import Login from "./Login/Login";
import TestFirebase from "./Test/firebaseTest";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/assign" element={<Assign />} />
        <Route path="/testfirebase" element={<TestFirebase />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;