import React, { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import BpmnViewer from "bpmn-js/lib/NavigatedViewer";

const BpmnViewerPage: React.FC = () => {
  const { filename } = useParams();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filename || !containerRef.current) return;

    const viewer = new BpmnViewer({ container: containerRef.current });

    const load = async () => {
      try {
        const response = await fetch(`/bpmn/${filename}`);
        const xml = await response.text();
        await viewer.importXML(xml);
        const canvas = viewer.get("canvas") as any;
        canvas.zoom("fit-viewport");
      } catch (err) {
        console.error("fail to load the file", err);
      }
    };

    load();

    return () => viewer.destroy();
  }, [filename]);

  return (
    <div style={{ padding: 20 }}>
      <h2>📄 BPMN Model Viewer - {filename}</h2>
      <div ref={containerRef} style={{ height: "80vh", border: "1px solid #ccc" }} />
    </div>
  );
};

export default BpmnViewerPage;
