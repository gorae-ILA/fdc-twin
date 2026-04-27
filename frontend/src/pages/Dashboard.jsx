// frontend/src/pages/Dashboard.jsx
// 전체 흐름: lot 선택 → cycle 슬라이더 → WaferMap + GrowthChart 연동
// 모든 데이터는 DB → API에서 fetch (하드코딩 없음)

import { useEffect, useState } from "react";
import { fetchRuns } from "../api/fdcApi";
import WaferMap    from "../components/WaferMap";
import GrowthChart from "../components/GrowthChart";
import CsvUpload   from "../components/CsvUpload";

export default function Dashboard() {
  const [runs, setRuns]             = useState([]);
  const [selectedLot, setSelectedLot] = useState("");
  const [totalCycles, setTotalCycles] = useState(100);
  const [cycle, setCycle]           = useState(1);
  const [playing, setPlaying] = useState(true);
  const [tab, setTab]               = useState("monitor"); // "monitor" | "upload"
  const [speedIdx, setSpeedIdx]     = useState(5);

  const SPEED_MAP = [0.1, 0.2, 0.4, 0.7, 0.85, 1, 1.5, 2, 3.5, 6, 10];

  // lot 목록 로드
  useEffect(() => {
    fetchRuns()
      .then(data => {
        setRuns(data);
        if (data.length > 0) {
          setSelectedLot(data[0].lot_id);
          setTotalCycles(data[0].total_cycles || 100);
          setCycle(1);
        }
      })
      .catch(console.error);
  }, []);

  // 애니메이션 재생
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setCycle(prev => {
        const next = prev + 1;
        if (next > totalCycles) { setPlaying(false); return totalCycles; }
        return next;
      });
    }, 1000 / SPEED_MAP[speedIdx]);
    return () => clearInterval(interval);
  }, [playing, speedIdx, totalCycles]);

  function handleLotChange(lotId) {
    const run = runs.find(r => r.lot_id === lotId);
    setSelectedLot(lotId);
    setTotalCycles(run?.total_cycles || 100);
    setCycle(1);
    setPlaying(false);
  }

  function handleUploadSuccess(result) {
    fetchRuns().then(data => {
      setRuns(data);
      setSelectedLot(result.lot_id);
      setTotalCycles(result.total_cycles || 100);
      setCycle(1);
      setTab("monitor");
    });
  }

  const cardStyle = {
    background: "var(--color-background-primary)",
    border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: 12, padding: 14,
  };

  return (
    <div style={{ fontFamily: "var(--font-sans)", padding: "8px 0" }}>

      {/* ── 헤더 ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>
          FDC Growth Monitoring
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {["monitor", "upload"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              fontSize: 12, padding: "5px 14px", borderRadius: 6, cursor: "pointer",
              border: "0.5px solid " + (tab === t ? "var(--color-border-info)" : "var(--color-border-secondary)"),
              background: tab === t ? "var(--color-background-info)" : "transparent",
              color: tab === t ? "var(--color-text-info)" : "var(--color-text-primary)",
              fontFamily: "var(--font-sans)",
            }}>
              {t === "monitor" ? "모니터링" : "CSV 업로드"}
            </button>
          ))}
        </div>
      </div>

      {/* ── 업로드 탭 ── */}
      {tab === "upload" && (
        <div style={cardStyle}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 12 }}>
            CSV 업로드 → PostgreSQL 저장
          </div>
          <CsvUpload onUploadSuccess={handleUploadSuccess} />
        </div>
      )}

      {/* ── 모니터링 탭 ── */}
      {tab === "monitor" && (
        <>
          {/* 컨트롤 바 */}
          <div style={{ ...cardStyle, marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* lot 선택 */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Lot</span>
              <select
                value={selectedLot}
                onChange={e => handleLotChange(e.target.value)}
                style={{
                  fontSize: 12, padding: "4px 8px", borderRadius: 6,
                  border: "0.5px solid var(--color-border-secondary)",
                  background: "var(--color-background-primary)", color: "var(--color-text-primary)",
                  fontFamily: "var(--font-sans)",
                }}
              >
                {runs.length === 0 && <option value="">데이터 없음</option>}
                {runs.map(r => (
                  <option key={r.run_id} value={r.lot_id}>{r.lot_id}</option>
                ))}
              </select>
            </div>

            {/* cycle 슬라이더 */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 160 }}>
              <span style={{ fontSize: 11, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                Cycle: <b style={{ color: "var(--color-text-primary)" }}>{cycle}</b> / {totalCycles}
              </span>
              <input
                type="range" min={1} max={totalCycles} value={cycle} step={1}
                onChange={e => { setPlaying(false); setCycle(+e.target.value); }}
                style={{ flex: 1 }}
              />
            </div>

            {/* 재생 / 초기화 */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button onClick={() => { if (cycle >= totalCycles) setCycle(1); setPlaying(p => !p); }} style={{
                fontSize: 12, padding: "5px 14px", borderRadius: 6, cursor: "pointer",
                border: "0.5px solid var(--color-border-info)",
                background: "var(--color-background-info)", color: "var(--color-text-info)",
                fontFamily: "var(--font-sans)",
              }}>
                {playing ? "일시정지" : "재생"}
              </button>
              <button onClick={() => { setPlaying(false); setCycle(1); }} style={{
                fontSize: 12, padding: "5px 14px", borderRadius: 6, cursor: "pointer",
                border: "0.5px solid var(--color-border-secondary)",
                background: "transparent", color: "var(--color-text-primary)",
                fontFamily: "var(--font-sans)",
              }}>
                초기화
              </button>
              <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>속도</span>
              <input type="range" min={1} max={11} value={speedIdx + 1} step={1}
                onChange={e => setSpeedIdx(+e.target.value - 1)} style={{ width: 72 }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-primary)", minWidth: 28 }}>
                {SPEED_MAP[speedIdx] < 1 ? "×" + SPEED_MAP[speedIdx].toFixed(1) : "×" + SPEED_MAP[speedIdx]}
              </span>
            </div>
          </div>

          {/* 메인 그리드 */}
          {runs.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 13, color: "var(--color-text-tertiary)" }}>
                CSV 업로드 탭에서 데이터를 먼저 업로드하세요
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12 }}>
              {/* 왼쪽: 성장 그래프 */}
              <div style={cardStyle}>
                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 8, textAlign: "center" }}>
                  Wafer Thickness Growth Graph
                </div>
                <GrowthChart lotId={selectedLot} currentCycle={cycle} />
              </div>

              {/* 오른쪽: 웨이퍼 맵 */}
              <div style={cardStyle}>
                <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 8, textAlign: "center" }}>
                  Final Wafer 49pts Thickness Mapping — Cycle {cycle}
                </div>
                <WaferMap lotId={selectedLot} cycle={cycle} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
