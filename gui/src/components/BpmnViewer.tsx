import React, { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import BpmnViewer from "bpmn-js/lib/NavigatedViewer";
import { useNavigate } from "react-router-dom"; // 顶部引入

const BpmnViewerPage: React.FC = () => {
  const { filename } = useParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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
<>
    <div style={{
        display: "flex",                 /* Flexbox aktivieren */
        alignItems: "center",            /* Vertikale Zentrierung der Elemente */
        padding: "10px 20px",            /* Innenabstand */
        backgroundColor: "#f0f0f0",       /* Hintergrundfarbe zur besseren Sichtbarkeit */
        position: "sticky",              /* Optional: Am oberen Rand haften bleiben */
        top: 0,                          /* Für 'sticky' oder 'fixed' */
        zIndex: 1000                     /* Sicherstellen, dass es über anderem Inhalt liegt */
    }}>
        {/* Platzhalter für linken Button, um den Titel zu zentrieren */}
        <div style={{ flex: 1, textAlign: "left" }}>
            <button onClick={() => navigate(-1)}>⬅ Back</button>
        </div>

        {/* Titel in der Mitte */}
        <h2 style={{ margin: 0, flex: 2, textAlign: "center", fontSize: "1.5em" }}>
            📄 BPMN Model Viewer - {filename}
        </h2>

        {/* Platzhalter für rechten Button */}
        <div style={{ flex: 1, textAlign: "right" }}>
            <button onClick={() => alert("Continue logic goes here")}>➡ Continue</button>
        </div>
    </div>

    <div style={{ padding: 20 }}>
        <div
            ref={containerRef}
            style={{
                height: "80vh",
                border: "1px solid #ccc",
                position: "relative" // Crucial: parent must be relative for absolute children
            }}
        >
            {/* This would be the actual content you want to position */}
            <div style={{
                position: "absolute", // 【关键】使这个元素可以精确定位
                left: "500cm",        // 【关键】距离左侧 50 厘米
                top: "5cm",          // 示例：距离顶部 5 厘米
                // 你还可以设置 width 和 height 来控制模型显示区域的大小
                // width: "calc(100% - 60cm)", // 如果要保持响应式，可以这样计算
                // height: "calc(80vh - 10cm)",
                backgroundColor: "lightblue", // 示例背景色，方便查看定位效果
                overflow: "auto" // 如果内容超出，提供滚动条
            }}>
                {/* 你的BPMN模型查看器实际内容会在这里渲染 */}
                {/* 例如：<img src="path/to/your/image.svg" alt="BPMN Model" style={{maxWidth: '100%', height: 'auto'}} /> */}
                {/* 或你的 BPMN 渲染库将内容注入到这个 div 中 */}
                {/*<p>这里是你的BPMN模型内容。</p>}
                <p>它可以精确控制距离。</p>
                {/* 确保你的BPMN渲染器能适应这个内部div的大小 */}
            </div>
        </div>
    </div>
</>
  );
};

export default BpmnViewerPage;
