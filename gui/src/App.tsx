import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import BpmnEditor from "./components/BpmnEditor";
import HomePage from "./components/HomePage";
import EventLog from "./components/EventLog";

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route
            path="/"
            element={<HomePage />}
          />
          <Route
            path="/editor"
            element={<BpmnEditor />}
          />
          <Route
            path="/eventlog"
            element={<EventLog />}
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
