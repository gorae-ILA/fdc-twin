// frontend/src/components/CsvUpload.jsx
import { useState } from "react";
import { uploadCsv } from "../api/fdcApi";

export default function CsvUpload({ onUploadSuccess }) {
  const [lotId, setLotId]     = useState("");
  const [equip, setEquip]     = useState("");
  const [file, setFile]       = useState(null);
  const [status, setStatus]   = useState(null); // null | "loading" | "ok" | "error"
  const [message, setMessage] = useState("");

  async function handleSubmit() {
    if (!file || !lotId.trim()) {
      setStatus("error"); setMessage("Lot ID와 파일을 모두 입력해주세요."); return;
    }
    setStatus("loading"); setMessage("");
    try {
      const result = await uploadCsv(file, lotId.trim(), equip.trim());
      setStatus("ok");
      setMessage(`✅ 업로드 완료 — ${result.total_cycles} cycles, run_id: ${result.run_id}`);
      onUploadSuccess?.(result);
    } catch (e) {
      setStatus("error"); setMessage("❌ " + e.message);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{
        border: "1.5px dashed var(--color-border-secondary)", borderRadius: 10,
        padding: 20, textAlign: "center", cursor: "pointer",
        background: file ? "var(--color-background-success)" : "transparent",
        transition: "background .15s"
      }}
        onClick={() => document.getElementById("csv-input").click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); }}
      >
        <input id="csv-input" type="file" accept=".csv" style={{ display: "none" }}
          onChange={e => setFile(e.target.files[0])} />
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
          {file ? `📄 ${file.name}` : "CSV 파일을 드래그하거나 클릭해서 업로드"}
        </div>
        <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 4 }}>
          롱 포맷(cycle, point_idx, thickness_nm) 또는 와이드 포맷(pt0~pt48) 지원
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>Lot ID *</div>
          <input
            value={lotId} onChange={e => setLotId(e.target.value)}
            placeholder="예: LOT-0421"
            style={{
              width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 6,
              border: "0.5px solid var(--color-border-secondary)",
              background: "var(--color-background-primary)", color: "var(--color-text-primary)",
              fontFamily: "var(--font-sans)"
            }}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>장비명</div>
          <input
            value={equip} onChange={e => setEquip(e.target.value)}
            placeholder="예: ALD-ULVAC-4"
            style={{
              width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 6,
              border: "0.5px solid var(--color-border-secondary)",
              background: "var(--color-background-primary)", color: "var(--color-text-primary)",
              fontFamily: "var(--font-sans)"
            }}
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={status === "loading"}
        style={{
          padding: "8px 0", borderRadius: 8, fontSize: 13, fontWeight: 500,
          border: "none", cursor: status === "loading" ? "default" : "pointer",
          background: "var(--color-background-info)", color: "var(--color-text-info)",
          fontFamily: "var(--font-sans)", opacity: status === "loading" ? 0.6 : 1,
        }}
      >
        {status === "loading" ? "업로드 중..." : "DB에 저장"}
      </button>

      {message && (
        <div style={{
          fontSize: 12, padding: "6px 10px", borderRadius: 6,
          background: status === "ok" ? "var(--color-background-success)" : "var(--color-background-danger)",
          color: status === "ok" ? "var(--color-text-success)" : "var(--color-text-danger)",
        }}>
          {message}
        </div>
      )}
    </div>
  );
}
