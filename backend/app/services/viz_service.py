from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.models import ThicknessMap, FdcParameter, FdcRun
import statistics

# ── 웨이퍼 컬러맵: 특정 사이클의 49포인트 ─────────────────────────
def get_thickness_map(db: Session, lot_id: str, cycle: int):
    run = db.query(FdcRun).filter(FdcRun.lot_id == lot_id).order_by(FdcRun.created_at.desc()).first()
    if not run:
        return None

    rows = (
        db.query(ThicknessMap)
        .filter(ThicknessMap.run_id == run.run_id, ThicknessMap.cycle == cycle)
        .order_by(ThicknessMap.point_idx)
        .all()
    )

    points = [
        {"point_idx": r.point_idx, "x": r.x, "y": r.y,
         "zone": r.zone, "thickness_nm": r.thickness_nm}
        for r in rows
    ]

    values = [p["thickness_nm"] for p in points]
    mean   = statistics.mean(values) if values else 0
    stdev  = statistics.stdev(values) if len(values) > 1 else 0
    outlier_thresh = mean + 2.5 * stdev

    for p in points:
        p["is_outlier"] = p["thickness_nm"] > outlier_thresh

    return {
        "lot_id": lot_id, "cycle": cycle,
        "points": points,
        "stats": {
            "mean": round(mean, 3),
            "sigma3": round(3 * stdev, 3),
            "min": round(min(values), 3) if values else 0,
            "max": round(max(values), 3) if values else 0,
            "non_uniformity": round((max(values) - min(values)) / mean * 100, 2) if mean else 0,
            "outlier_count": sum(1 for p in points if p["is_outlier"]),
        }
    }


# ── C/M/E 성장 그래프: 전체 사이클 시계열 ──────────────────────────
def get_cme_growth(db: Session, lot_id: str):
    run = db.query(FdcRun).filter(FdcRun.lot_id == lot_id).order_by(FdcRun.created_at.desc()).first()
    if not run:
        return None

    # 사이클 × zone 평균 집계 — DB에서 직접 계산
    rows = (
        db.query(
            ThicknessMap.cycle,
            ThicknessMap.zone,
            func.avg(ThicknessMap.thickness_nm).label("avg_thickness"),
        )
        .filter(ThicknessMap.run_id == run.run_id)
        .group_by(ThicknessMap.cycle, ThicknessMap.zone)
        .order_by(ThicknessMap.cycle)
        .all()
    )

    # cycle → {C, M, E} 딕셔너리로 변환
    data: dict[int, dict] = {}
    for r in rows:
        data.setdefault(r.cycle, {})[r.zone] = round(r.avg_thickness, 4)

    series = [
        {
            "cycle": c,
            "center": v.get("C", 0),
            "middle": v.get("M", 0),
            "edge":   v.get("E", 0),
            "total":  round((v.get("C", 0) + v.get("M", 0) + v.get("E", 0)) / 3, 4),
        }
        for c, v in sorted(data.items())
    ]

    # 최종 사이클 기준 skew
    last = series[-1] if series else {}
    skew = {
        "cm": round(last.get("center", 0) - last.get("middle", 0), 4),
        "me": round(last.get("middle", 0) - last.get("edge",   0), 4),
        "ce": round(last.get("center", 0) - last.get("edge",   0), 4),
    }

    return {
        "lot_id": lot_id,
        "total_cycles": run.total_cycles,
        "series": series,
        "skew": skew,
    }


# ── 이상치 탐지: 전체 사이클 기준 ─────────────────────────────────
def get_outliers(db: Session, lot_id: str):
    run = db.query(FdcRun).filter(FdcRun.lot_id == lot_id).order_by(FdcRun.created_at.desc()).first()
    if not run:
        return None

    rows = db.query(ThicknessMap).filter(ThicknessMap.run_id == run.run_id).all()
    values = [r.thickness_nm for r in rows]
    if not values:
        return {"lot_id": lot_id, "outliers": []}

    mean  = statistics.mean(values)
    stdev = statistics.stdev(values) if len(values) > 1 else 0
    thresh = mean + 2.5 * stdev

    outliers = [
        {"cycle": r.cycle, "point_idx": r.point_idx,
         "x": r.x, "y": r.y, "zone": r.zone,
         "thickness_nm": r.thickness_nm,
         "deviation": round(r.thickness_nm - mean, 3)}
        for r in rows if r.thickness_nm > thresh
    ]

    return {"lot_id": lot_id, "threshold": round(thresh, 3), "outliers": outliers}
