import React, { useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import BpmnViewer from "bpmn-js/lib/NavigatedViewer";


const BpmnViewerPage: React.FC = () => {
  const { filename } = useParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const viewer = new BpmnViewer({ container: containerRef.current! });

    const load = async () => {
      const decodedFilename = decodeURIComponent(filename || "");
      
      try {
        const response = await fetch(`http://localhost:8000/api/bpmn/${decodedFilename}`);
        const json = await response.json();
        const { bpmn_xml } = json;
        
        await viewer.importXML(bpmn_xml);
        (viewer.get("canvas") as any).zoom("fit-viewport");
      } catch (err) {
        console.error("Failed to load BPMN:", err);
      }
    };

    if (filename) load();

    return () => viewer.destroy();
  }, [filename]);

  const handleContinue = async () => {
    if (!filename) return;

    try {
      const decodedPath = decodeURIComponent(filename);

      const res = await fetch("http://localhost:8000/select-model/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_path: decodedPath,
        }),
      });

      const result = await res.json();
      alert(`✅ Model selected: ${result.model_path}`);
      navigate("/");
    } catch (err) {
      console.error("Failed to send selection", err);
    }
  };


  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 20px",
          backgroundColor: "#f0f0f0",
          position: "sticky",
          top: 0,
          zIndex: 1000,
        }}
      >
        <div style={{ flex: 1, textAlign: "left" }}>
          <button onClick={() => navigate(-1)}>⬅ Back</button>
        </div>
        <h2 style={{ margin: 0, flex: 2, textAlign: "center" }}>
          📄 BPMN Model Viewer - {filename}
        </h2>
        <div style={{ flex: 1, textAlign: "right" }}>
          <button onClick={handleContinue}>➡ Continue</button>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        <div ref={containerRef} style={{ height: "80vh", border: "1px solid #ccc" }} />
      </div>
    </>
  );
};

export default BpmnViewerPage;