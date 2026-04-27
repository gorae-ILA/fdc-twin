import pandas as pd
import math
from io import BytesIO
from sqlalchemy.orm import Session
from app.models.models import FdcRun, ThicknessMap, FdcParameter, RunStatus

# ── 웨이퍼 49포인트 정규화 좌표 (링 구조) ──────────────────────────
def _build_49pts():
    import math
    pts = []
    rings = [(0, 1), (0.19, 6), (0.39, 10), (0.58, 14), (0.78, 12), (0.97, 6)]
    for r, n in rings:
        for i in range(n):
            a = 2 * math.pi * i / n - math.pi / 2
            pts.append((round(r * math.cos(a), 6), round(r * math.sin(a), 6), r))
    return pts[:49]

PT_LAYOUT = _build_49pts()

def _zone(r: float) -> str:
    if r < 0.29:  return "C"
    if r < 0.68:  return "M"
    return "E"


# ── CSV 파싱 ────────────────────────────────────────────────────────
# 지원 포맷 A: 사이클 × 포인트 롱 포맷
#   cycle, point_idx, thickness_nm, [temp_c, pressure, gas_flow, rf_power]
#
# 지원 포맷 B: 와이드 포맷 (Columbus 스타일)
#   cycle, pt0, pt1, ..., pt48, [temp_c, ...]
#
def parse_csv(contents: bytes) -> dict:
    df = pd.read_csv(BytesIO(contents))
    df.columns = [c.strip().lower() for c in df.columns]

    # 포맷 B 감지: pt0 ~ pt48 컬럼 존재
    wide_cols = [c for c in df.columns if c.startswith("pt")]
    if len(wide_cols) >= 49:
        return _parse_wide(df, wide_cols)
    return _parse_long(df)


def _parse_long(df: pd.DataFrame) -> dict:
    required = {"cycle", "point_idx", "thickness_nm"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"필수 컬럼 없음: {missing}")

    thickness_rows = []
    for _, row in df.iterrows():
        idx = int(row["point_idx"])
        x, y, r = PT_LAYOUT[idx]
        thickness_rows.append({
            "cycle":        int(row["cycle"]),
            "point_idx":    idx,
            "x": x, "y": y,
            "zone":         _zone(r),
            "thickness_nm": float(row["thickness_nm"]),
        })

    fdc_cols = {"temp_c", "pressure", "gas_flow", "rf_power"}
    fdc_rows = []
    if fdc_cols & set(df.columns):
        for cycle, g in df.groupby("cycle"):
            row = g.iloc[0]
            fdc_rows.append({
                "cycle":    int(cycle),
                "temp_c":   float(row.get("temp_c",   0) or 0),
                "pressure": float(row.get("pressure", 0) or 0),
                "gas_flow": float(row.get("gas_flow", 0) or 0),
                "rf_power": float(row.get("rf_power", 0) or 0),
            })

    return {"thickness": thickness_rows, "fdc": fdc_rows,
            "total_cycles": int(df["cycle"].max())}


def _parse_wide(df: pd.DataFrame, wide_cols: list) -> dict:
    thickness_rows = []
    for _, row in df.iterrows():
        for i, col in enumerate(wide_cols[:49]):
            x, y, r = PT_LAYOUT[i]
            thickness_rows.append({
                "cycle":        int(row["cycle"]),
                "point_idx":    i,
                "x": x, "y": y,
                "zone":         _zone(r),
                "thickness_nm": float(row[col]),
            })

    fdc_cols = {"temp_c", "pressure", "gas_flow", "rf_power"}
    fdc_rows = []
    if fdc_cols & set(df.columns):
        for _, row in df.iterrows():
            fdc_rows.append({
                "cycle":    int(row["cycle"]),
                "temp_c":   float(row.get("temp_c",   0) or 0),
                "pressure": float(row.get("pressure", 0) or 0),
                "gas_flow": float(row.get("gas_flow", 0) or 0),
                "rf_power": float(row.get("rf_power", 0) or 0),
            })

    return {"thickness": thickness_rows, "fdc": fdc_rows,
            "total_cycles": int(df["cycle"].max())}


# ── DB 저장 ─────────────────────────────────────────────────────────
def save_run(db: Session, lot_id: str, equipment: str, parsed: dict) -> FdcRun:
    run = FdcRun(
        lot_id=lot_id,
        equipment=equipment,
        total_cycles=parsed["total_cycles"],
        status=RunStatus.processing,
    )
    db.add(run)
    db.flush()  # run_id 확보

    # 두께 데이터 bulk insert
    db.bulk_insert_mappings(ThicknessMap, [
        {"run_id": run.run_id, **r} for r in parsed["thickness"]
    ])

    # FDC 파라미터 bulk insert
    if parsed["fdc"]:
        db.bulk_insert_mappings(FdcParameter, [
            {"run_id": run.run_id, **r} for r in parsed["fdc"]
        ])

    run.status = RunStatus.completed
    db.commit()
    db.refresh(run)
    return run
