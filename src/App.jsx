import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Analytics from "./Analytics/analytics";
import Profile from "./Profile/profile";
import Assign from "./Assign/assign";
import Dashboard from "./Dashboard/Dashboard";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/assign" element={<Assign />} />
      </Routes>
    </Router>
  );
}

export default App;