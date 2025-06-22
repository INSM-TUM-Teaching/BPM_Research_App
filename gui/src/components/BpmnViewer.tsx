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
      try {
        const response = await fetch(`http://localhost:8000/bestbpmns/${filename}`);
        const xml = await response.text();
        await viewer.importXML(xml);
        const canvas = viewer.get("canvas") as { zoom: (arg: string) => void };
        canvas.zoom("fit-viewport");
      } catch (err) {
        console.error("fail to load the file", err);
      }
    };

    if (filename) load();

    return () => viewer.destroy();
  }, [filename]);

  const handleContinue = async () => {
    if (!filename) return;

    try {
      const res = await fetch("http://localhost:8000/select-model/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_path: `generated_bpmn/${filename}` }),
      });

      const result = await res.json();
      alert(`✅ Model selected: ${result.model_path}`);
      navigate("/"); // 可自定义跳转路径
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
