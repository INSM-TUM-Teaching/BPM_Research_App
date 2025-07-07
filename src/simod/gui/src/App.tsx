import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import BpmnEditor from "./components/BpmnEditor";
import HomePage from "./components/HomePage";
import EventLog from "./components/EventLog";
import BestBpmns from "./components/BestBpmns";
import BpmnViewer from "./components/BpmnViewer";
import LoadingScreen from "./components/LoadingScreen";
import ResultsPage from "./components/ResultsPage";
import ResourceMoelLoadingScreen from "./components/ResourceModelLoading";


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
          <Route
           path="/top-3-results" element={<BestBpmns />} 
           />
          <Route
           path="/bpmn" element={<BpmnViewer/>} 
           />
           <Route 
           path="/loading" element={<LoadingScreen />} 
           />
          <Route 
           path="/resource-model-loading" element={<ResourceMoelLoadingScreen/>} 
           />
           <Route 
           path="/results" element={<ResultsPage />} 
           />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
