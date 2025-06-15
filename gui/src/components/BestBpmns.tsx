import React from "react";
import { useNavigate } from "react-router-dom";

const bpmnList = ["test1.bpmn", "test2.bpmn", "test3.bpmn"];

const BestBpmns: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ padding: 40 }}>
      <h2 style={{ textAlign: "center" }}>🏆 Best 3 BPMN</h2>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
        {bpmnList.map((file, index) => (
          <div
            key={file}
            onClick={() => navigate(`/bpmn/${encodeURIComponent(file)}`)}
            style={{
              border: "1px solid #ccc",
              padding: 16,
              width: 300,
              cursor: "pointer",
              transition: "transform 0.3s",
              borderRadius: 10,
              background: "#f9f9f9",
            }}
            onMouseEnter={(e) => ((e.currentTarget.style.transform = "scale(1.05)"))}
            onMouseLeave={(e) => ((e.currentTarget.style.transform = "scale(1)"))}
          >
            <h3 style={{ textAlign: "center" }}>{file}</h3>
            <div style={{ height: 200, backgroundColor: "#eee" }}>Click to check</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BestBpmns;
