import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import BpmnEditor from "./components/BpmnEditor";
import HomePage from "./components/HomePage";
import EventLog from "./components/EventLog";
import BestBpmns from "./components/BestBpmns";
import BpmnViewer from "./components/BpmnViewer";


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
          <Route path="/bestbpmns" element={<BestBpmns />} />
          <Route path="/bpmn/:filename" element={<BpmnViewer/>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
