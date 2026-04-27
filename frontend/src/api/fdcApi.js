// frontend/src/api/fdcApi.js

let idx = 0;

const scenarios = [
  { base: 100, drift: 0.0, outlier: 0 },
  { base: 101, drift: 0.4, outlier: 1 },
  { base: 102, drift: 0.8, outlier: 2 },
  { base: 103, drift: 1.2, outlier: 1 },
  { base: 104, drift: 1.6, outlier: 3 },
];

function nextScenario() {
  const s = scenarios[idx];
  idx = (idx + 1) % scenarios.length;
  return s;
}

// 업로드 mock
export async function uploadCsv(file, lotId, equipment = "") {
  return {
    run_id: 1,
    lot_id: lotId || "LOT001",
    total_cycles: 25,
    status: "mock"
  };
}

// lot 목록 mock
export async function fetchRuns() {
  return [
    { run_id: 1, lot_id: "LOT001", total_cycles: 25 },
    { run_id: 2, lot_id: "LOT002", total_cycles: 18 }
  ];
}

// 웨이퍼맵 (호출마다 다음 데이터)
export async function fetchThicknessMap(lotId, cycle) {
  const s = nextScenario();

  const points = Array.from({ length: 49 }, (_, i) => {
    const angle = (i / 49) * Math.PI * 2;
    const radius = ((i % 7) + 1) / 8 * 0.9;

    return {
      point_idx: i + 1,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      zone: i < 16 ? "C" : i < 32 ? "M" : "E",
      thickness_nm: s.base + Math.sin(i) * 2 + s.drift,
      is_outlier: i < s.outlier
    };
  });

  const vals = points.map(v => v.thickness_nm);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const mean = vals.reduce((a,b)=>a+b,0) / vals.length;

  return {
    points,
    stats: {
      min,
      max,
      mean,
      sigma3: (max - min).toFixed(2),
      non_uniformity: (((max-min)/mean)*100).toFixed(2),
      outlier_count: s.outlier
    }
  };
}

// 성장 그래프 mock
export async function fetchCmeGrowth(lotId) {
  const s = scenarios[idx];

  return {
    series: Array.from({ length: 20 }, (_, i) => ({
      cycle: i + 1,
      center: s.base + i * 0.25,
      middle: s.base + i * 0.20,
      edge: s.base + i * 0.32,
      total: s.base + i * 0.24
    })),
    skew: s.drift
  };
}

// 이상치 mock
export async function fetchOutliers(lotId) {
  const s = scenarios[idx];

  return {
    outliers: Array.from({ length: s.outlier }, (_, i) => ({
      cycle: idx,
      point_idx: i + 1,
      thickness_nm: s.base + 5 + i,
      deviation: (2.1 + i).toFixed(2)
    }))
  };
}