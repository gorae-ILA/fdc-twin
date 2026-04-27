from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.upload_service import parse_csv, save_run
from app.services.viz_service import get_thickness_map, get_cme_growth, get_outliers

router = APIRouter(prefix="/api", tags=["fdc"])


# ── POST /api/upload ────────────────────────────────────────────────
# CSV 업로드 → 파싱 → DB 저장
# Form 파라미터: lot_id (필수), equipment (선택)
@router.post("/upload")
async def upload_csv(
    file:      UploadFile = File(...),
    lot_id:    str        = Form(...),
    equipment: str        = Form(default=""),
    db:        Session    = Depends(get_db),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="CSV 파일만 업로드 가능합니다.")

    contents = await file.read()
    try:
        parsed = parse_csv(contents)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    run = save_run(db, lot_id=lot_id, equipment=equipment, parsed=parsed)
    return {
        "run_id":       run.run_id,
        "lot_id":       run.lot_id,
        "total_cycles": run.total_cycles,
        "status":       run.status,
    }


# ── GET /api/thickness/map ──────────────────────────────────────────
# 특정 lot + cycle의 49포인트 두께 반환 → 웨이퍼 컬러맵용
@router.get("/thickness/map")
def thickness_map(lot_id: str, cycle: int, db: Session = Depends(get_db)):
    result = get_thickness_map(db, lot_id=lot_id, cycle=cycle)
    if not result:
        raise HTTPException(status_code=404, detail=f"lot_id '{lot_id}' 데이터 없음")
    return result


# ── GET /api/growth/cme ─────────────────────────────────────────────
# 전체 사이클 C/M/E 평균 두께 시계열 → 성장 그래프용
@router.get("/growth/cme")
def growth_cme(lot_id: str, db: Session = Depends(get_db)):
    result = get_cme_growth(db, lot_id=lot_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"lot_id '{lot_id}' 데이터 없음")
    return result


# ── GET /api/outliers ───────────────────────────────────────────────
# IQR 기반 이상치 포인트 목록 반환
@router.get("/outliers")
def outliers(lot_id: str, db: Session = Depends(get_db)):
    result = get_outliers(db, lot_id=lot_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"lot_id '{lot_id}' 데이터 없음")
    return result


# ── GET /api/runs ───────────────────────────────────────────────────
# 업로드된 lot 목록 조회
@router.get("/runs")
def list_runs(db: Session = Depends(get_db)):
    from app.models.models import FdcRun
    runs = db.query(FdcRun).order_by(FdcRun.created_at.desc()).limit(50).all()
    return [
        {"run_id": r.run_id, "lot_id": r.lot_id,
         "equipment": r.equipment, "total_cycles": r.total_cycles,
         "status": r.status, "created_at": r.created_at}
        for r in runs
    ]
