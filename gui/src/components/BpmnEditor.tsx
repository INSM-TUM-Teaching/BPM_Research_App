import React, { useEffect, useRef, useState, ChangeEvent } from "react";
import Modeler from "bpmn-js/lib/Modeler";

// ────────────────────────────────────────────────────────────────────────────────
// BPMN‑JS STYLES – üçü de lazım
import "bpmn-js/dist/assets/diagram-js.css"; // temel diyagram
import "bpmn-js/dist/assets/bpmn-js.css"; // palette + context pad
import "bpmn-js/dist/assets/bpmn-font/css/bpmn.css"; // ikon fontu

// ────────────────────────────────────────────────────────────────────────────────

// Başlangıç diyagramı (boş bırakabilirsiniz)
const DEFAULT_DIAGRAM = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_0q1u91e" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false" />
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1" />
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const BpmnEditor: React.FC = () => {
  const modelerRef = useRef<InstanceType<typeof Modeler> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, forceUpdate] = useState(0);

  // ────────────────────────── MODELER LIFECYCLE ──────────────────────────
  useEffect(() => {
    modelerRef.current = new Modeler({
      container: containerRef.current!,
      keyboard: { bindTo: window }, // klavye kısayolları tüm pencere için
    });

    modelerRef.current.importXML(DEFAULT_DIAGRAM).catch(console.error);

    return () => {
      modelerRef.current?.destroy();
      modelerRef.current = null;
    };
  }, []);

  // ────────────────────────────── HANDLERS ──────────────────────────────
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await modelerRef.current?.importXML(reader.result as string);
        forceUpdate((n) => n + 1); // yeniden çizim için
      } catch (err) {
        console.error(err);
        alert("BPMN dosyası içe aktarılırken bir hata oluştu. Lütfen XML'in geçerli olduğundan emin olun.");
      }
    };
    reader.readAsText(file);
  };

  const handleDownload = async () => {
    if (!modelerRef.current) return;
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const blob = new Blob([xml], { type: "application/bpmn20-xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "diagram.bpmn";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("XML kaydedilirken hata oluştu.");
    }
  };

  // ─────────────────────────────── RENDER ────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        margin: 0,
      }}
    >
      {/* ÜST BAR */}
      <div style={{ padding: 8 }}>
        <input
          type="file"
          accept=".bpmn,.xml"
          onChange={handleFileChange}
        />
        <button
          className="px-3 py-1 border rounded"
          onClick={handleDownload}
        >
          Kaydet
        </button>
      </div>
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 0,
        }}
      />
    </div>
  );
};

export default BpmnEditor;
