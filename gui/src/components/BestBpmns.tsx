import React, { useEffect, useState, useRef } from "react";
import Viewer from "bpmn-js/lib/Viewer";
import { useNavigate } from "react-router-dom";

interface BpmnInfo {
  id: string;
  filename: string;
  //score: number;
}

const BpmnThumbnail: React.FC<{ file: string }> = ({ file }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const viewer = new Viewer({ container: ref.current });

    const load = async () => {
      try {
        const response = await fetch(`/bpmn/${file}`);
        const xml = await response.text();
        await viewer.importXML(xml);
        const canvas = viewer.get("canvas") as any;
        canvas.zoom("fit-viewport");
      } catch (err) {
        console.error("thumbnail load failed:", err);
      }
    };

    load();

    return () => viewer.destroy();
  }, [file]);

  
  return <div ref={ref} style={{ height: 200, background: "#f0f0f0" }} />;
};

const BestBpmns: React.FC = () => {
  const [bpmnList, setBpmnList] = useState<BpmnInfo[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://localhost:8000/bestbpmns/")
      .then((res) => res.json())
      .then((data) => setBpmnList(data.results || []))
      .catch((err) => console.error("Failed to load BPMN list", err));
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h2 style={{ textAlign: "center" }}>🏆 Best 3 BPMN</h2>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
        {bpmnList.map(({ id, filename }) => (
          <div
            key={id}
            onClick={() => navigate(`/bpmn/${encodeURIComponent(filename)}`)}
            style={{
              border: "1px solid #ccc",
              padding: 16,
              width: 300,
              cursor: "pointer",
              borderRadius: 10,
              background: "#f9f9f9",
            }}
          >
            <h3 style={{ textAlign: "center" }}>{id}</h3>
            <BpmnThumbnail file={filename} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default BestBpmns;
