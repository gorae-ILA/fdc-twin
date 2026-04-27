// frontend/src/components/GrowthChart.jsx
// fetchCmeGrowth(lotId) → DB에서 전체 사이클 시계열 받아서 렌더링
// Chart.js 사용 — 하드코딩 수학 함수 완전히 제거

import { useEffect, useRef, useState } from "react";
import { fetchCmeGrowth } from "../api/fdcApi";

export default function GrowthChart({ lotId, currentCycle }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);
  const [skew, setSkew]       = useState(null);
  const [cmeVals, setCmeVals] = useState({ center: 0, middle: 0, edge: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  // lot 변경 시 전체 시계열 로드
  useEffect(() => {
    if (!lotId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchCmeGrowth(lotId);
        if (cancelled) return;
        setSkew(data.skew);
        buildChart(data.series);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [lotId]);

  // currentCycle 변경 시 현재 사이클 값 업데이트
  useEffect(() => {
    if (!chartRef.current || currentCycle == null) return;
    const chart = chartRef.current;
    const idx = chart.data.labels.indexOf(currentCycle);
    if (idx === -1) return;
    setCmeVals({
      center: chart.data.datasets[0].data[idx] ?? 0,
      middle: chart.data.datasets[1].data[idx] ?? 0,
      edge:   chart.data.datasets[2].data[idx] ?? 0,
      total:  chart.data.datasets[3].data[idx] ?? 0,
    });
    // 수직선 플러그인으로 현재 사이클 표시
    chart.options.plugins.annotation = {
      annotations: {
        currentLine: {
          type: "line", xMin: currentCycle, xMax: currentCycle,
          borderColor: "rgba(200,200,200,0.5)", borderWidth: 1, borderDash: [4, 3],
        }
      }
    };
    chart.update("none");
  }, [currentCycle]);

  function buildChart(series) {
    const canvas = canvasRef.current;
    if (!canvas || !window.Chart) return;

    // 기존 차트 제거
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const labels  = series.map(s => s.cycle);
    const centerD = series.map(s => s.center);
    const middleD = series.map(s => s.middle);
    const edgeD   = series.map(s => s.edge);
    const totalD  = series.map(s => s.total);

    chartRef.current = new window.Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Center", data: centerD, borderColor: "#E25555", borderWidth: 1.5, pointRadius: 0, tension: 0.2 },
          { label: "Middle", data: middleD, borderColor: "#55AA55", borderWidth: 1.5, pointRadius: 0, tension: 0.2 },
          { label: "Edge",   data: edgeD,   borderColor: "#5588DD", borderWidth: 1.5, pointRadius: 0, tension: 0.2 },
          { label: "Total",  data: totalD,  borderColor: "#AAAAAA", borderWidth: 1,   pointRadius: 0, tension: 0.2, borderDash: [4, 3] },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 0 },
        plugins: { legend: { display: false } },
        scales: {
          x: {
            title: { display: true, text: "Cycle", font: { size: 10 }, color: "#888" },
            ticks: { font: { size: 9 }, color: "#888", maxTicksLimit: 11 },
            grid:  { color: "rgba(150,150,150,0.08)" },
          },
          y: {
            title: { display: true, text: "Avg Thickness (nm)", font: { size: 10 }, color: "#888" },
            ticks: { font: { size: 9 }, color: "#888" },
            grid:  { color: "rgba(150,150,150,0.08)" },
          },
        },
      },
    });

    // 초기 마지막 값 표시
    const last = series[series.length - 1];
    if (last) setCmeVals({ center: last.center, middle: last.middle, edge: last.edge, total: last.total });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {loading && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "center" }}>데이터 로딩 중...</div>}
      {error   && <div style={{ fontSize: 11, color: "#E24B4A", textAlign: "center" }}>{error}</div>}

      {/* 범례 */}
      <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
        {[["Center", "#E25555"], ["Middle", "#55AA55"], ["Edge", "#5588DD"], ["Total", "#AAAAAA"]].map(([label, color]) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--color-text-secondary)" }}>
            <span style={{ width: 14, height: 2, background: color, display: "inline-block", borderRadius: 1 }} />
            {label}
          </span>
        ))}
      </div>

      {/* 차트 영역 */}
      <div style={{ position: "relative", width: "100%", height: 200 }}>
        <canvas ref={canvasRef} />
      </div>

      {/* C/M/E/Total 수치 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
        {[["Center", cmeVals.center, "#E25555"],
          ["Middle", cmeVals.middle, "#55AA55"],
          ["Edge",   cmeVals.edge,   "#5588DD"],
          ["Total",  cmeVals.total,  "#888"]
        ].map(([label, val, color]) => (
          <div key={label} style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color }}>{(+val).toFixed(3)}</div>
          </div>
        ))}
      </div>

      {/* Skew 테이블 */}
      {skew && (
        <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 8 }}>
          <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginBottom: 6 }}>Skew (nm)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
            {[["C-M", skew.cm], ["M-E", skew.me], ["C-E", skew.ce]].map(([label, val]) => (
              <div key={label} style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                {label}: <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{(+val).toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
