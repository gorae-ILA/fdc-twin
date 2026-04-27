// frontend/src/components/WaferMap.jsx
// fetchThicknessMap(lotId, cycle) → DB에서 49pt 받아서 렌더링

import { useEffect, useRef, useState } from "react";
import { fetchThicknessMap } from "../api/fdcApi";

const WW = 240, WR = 108, WCX = 120, WCY = 120;

function ptColor(v, mn, mx) {
  const t = Math.max(0, Math.min(1, (v - mn) / (mx - mn)));
  const stops = [
    [0,    [0,   0,   200]],
    [0.2,  [0,   140, 230]],
    [0.4,  [0,   210, 80 ]],
    [0.6,  [240, 230, 0  ]],
    [0.8,  [255, 110, 0  ]],
    [1,    [210, 0,   0  ]],
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) { lo = stops[i]; hi = stops[i + 1]; break; }
  }
  const f = lo[0] === hi[0] ? 0 : (t - lo[0]) / (hi[0] - lo[0]);
  return stops.map((_, idx) => 0).map((__, k) =>
    Math.round(lo[1][k] + (hi[1][k] - lo[1][k]) * f)
  );
  // 위 줄 단순화:
}

function interpolateColor(v, mn, mx) {
  const t = Math.max(0, Math.min(1, (v - mn) / (mx - mn)));
  const stops = [
    [0,    [0,   0,   200]],
    [0.2,  [0,   140, 230]],
    [0.4,  [0,   210, 80 ]],
    [0.6,  [240, 230, 0  ]],
    [0.8,  [255, 110, 0  ]],
    [1,    [210, 0,   0  ]],
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) { lo = stops[i]; hi = stops[i + 1]; break; }
  }
  const f = lo[0] === hi[0] ? 0 : (t - lo[0]) / (hi[0] - lo[0]);
  return [0, 1, 2].map(k => Math.round(lo[1][k] + (hi[1][k] - lo[1][k]) * f));
}

export default function WaferMap({ lotId, cycle }) {
  const canvasRef = useRef(null);
  const cbRef     = useRef(null);
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!lotId || cycle == null) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchThicknessMap(lotId, cycle);
        if (cancelled) return;
        setStats(data.stats);
        drawWafer(data.points);
        drawColorbar(
          data.stats.min,
          data.stats.max
        );
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [lotId, cycle]);

  function drawWafer(points) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, WW, WW);

    const values = points.map(p => p.thickness_nm);
    const mn = Math.min(...values), mx = Math.max(...values);

    // IDW 픽셀 채우기
    ctx.save();
    ctx.beginPath(); ctx.arc(WCX, WCY, WR, 0, Math.PI * 2); ctx.clip();
    const img = ctx.createImageData(WW, WW);
    for (let py = 0; py < WW; py++) {
      for (let px = 0; px < WW; px++) {
        const dx = (px - WCX) / WR, dy = (py - WCY) / WR;
        if (dx * dx + dy * dy > 1) continue;
        let ws = 0, vs = 0;
        points.forEach(p => {
          const d = Math.sqrt((dx - p.x) ** 2 + (dy - p.y) ** 2) + 1e-4;
          const w = 1 / (d * d); ws += w; vs += w * p.thickness_nm;
        });
        const [r, g, b] = interpolateColor(vs / ws, mn, mx);
        const idx = (py * WW + px) * 4;
        img.data[idx] = r; img.data[idx+1] = g; img.data[idx+2] = b; img.data[idx+3] = 235;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.restore();

    // 가이드 링
    [0.33, 0.66].forEach(f => {
      ctx.beginPath(); ctx.arc(WCX, WCY, WR * f, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 0.6; ctx.stroke();
    });

    // 49pt 라벨
    ctx.font = "bold 7px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    points.forEach(p => {
      const px = WCX + p.x * WR, py = WCY + p.y * WR;
      // 이상치는 빨간 테두리
      if (p.is_outlier) {
        ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.strokeStyle = "#E24B4A"; ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fillText(p.thickness_nm.toFixed(2), px, py);
    });

    // 외곽 + 노치
    ctx.beginPath(); ctx.arc(WCX, WCY, WR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(160,160,160,0.35)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(WCX - 5, WCY + WR - 2); ctx.lineTo(WCX + 5, WCY + WR - 2); ctx.lineTo(WCX, WCY + WR + 8);
    ctx.closePath(); ctx.fillStyle = "rgba(140,140,140,0.5)"; ctx.fill();
  }

  function drawColorbar(mn, mx) {
    const cb = cbRef.current; if (!cb) return;
    const ctx = cb.getContext("2d");
    const H = 140;
    const id = ctx.createImageData(12, H);
    for (let y = 0; y < H; y++) {
      const v = mx - (mx - mn) * (y / H);
      const [r, g, b] = interpolateColor(v, mn, mx);
      for (let x = 0; x < 12; x++) {
        const i = (y * 12 + x) * 4;
        id.data[i] = r; id.data[i+1] = g; id.data[i+2] = b; id.data[i+3] = 220;
      }
    }
    ctx.putImageData(id, 0, 0);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {loading && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>로딩 중...</div>}
      {error   && <div style={{ fontSize: 11, color: "#E24B4A" }}>{error}</div>}

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <canvas ref={canvasRef} width={WW} height={WW} style={{ display: "block" }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>
            {stats ? stats.max.toFixed(2) : "—"}
          </span>
          <canvas ref={cbRef} width={12} height={140} style={{ display: "block", borderRadius: 2 }} />
          <span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>
            {stats ? stats.min.toFixed(2) : "—"}
          </span>
        </div>
      </div>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, width: "100%" }}>
          {[["평균", stats.mean], ["3σ", stats.sigma3],
            ["Non-U", stats.non_uniformity + "%"], ["이상치", stats.outlier_count + "pt"]
          ].map(([label, val]) => (
            <div key={label} style={{
              background: "var(--color-background-secondary)",
              borderRadius: 8, padding: "6px 8px", textAlign: "center"
            }}>
              <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{val}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
