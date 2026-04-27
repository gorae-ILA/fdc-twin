from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class RunStatus(str, enum.Enum):
    processing = "processing"
    completed  = "completed"
    error      = "error"

class FdcRun(Base):
    """
    Lot 단위 공정 실행 메타데이터.
    CSV 업로드 1건 = FdcRun 1행.
    """
    __tablename__ = "fdc_run"

    run_id       = Column(Integer, primary_key=True, index=True)
    lot_id       = Column(String(64), nullable=False, index=True)
    equipment    = Column(String(64), nullable=True)
    total_cycles = Column(Integer,  nullable=True)
    status       = Column(Enum(RunStatus), default=RunStatus.processing)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    thickness_records = relationship("ThicknessMap",  back_populates="run", cascade="all, delete")
    fdc_records       = relationship("FdcParameter",  back_populates="run", cascade="all, delete")


class ThicknessMap(Base):
    """
    사이클별 49포인트 두께 측정값.
    point_idx: 0~48  (링 순서 기준)
    x, y: 웨이퍼 정규화 좌표 (-1 ~ 1)
    thickness_nm: 측정 두께 (nm)
    """
    __tablename__ = "thickness_map"

    map_id       = Column(Integer, primary_key=True, index=True)
    run_id       = Column(Integer, ForeignKey("fdc_run.run_id"), nullable=False, index=True)
    cycle        = Column(Integer, nullable=False, index=True)
    point_idx    = Column(Integer, nullable=False)   # 0~48
    x            = Column(Float,   nullable=False)   # 정규화 x (-1 ~ 1)
    y            = Column(Float,   nullable=False)   # 정규화 y (-1 ~ 1)
    zone         = Column(String(8), nullable=True)  # 'C' | 'M' | 'E'
    thickness_nm = Column(Float,   nullable=False)

    run = relationship("FdcRun", back_populates="thickness_records")


class FdcParameter(Base):
    """
    사이클별 FDC 공정 변수.
    온도/압력/가스유량/RF파워 등.
    """
    __tablename__ = "fdc_parameter"

    param_id  = Column(Integer, primary_key=True, index=True)
    run_id    = Column(Integer, ForeignKey("fdc_run.run_id"), nullable=False, index=True)
    cycle     = Column(Integer, nullable=False, index=True)
    temp_c    = Column(Float,   nullable=True)   # 온도 (°C)
    pressure  = Column(Float,   nullable=True)   # 압력 (mTorr)
    gas_flow  = Column(Float,   nullable=True)   # 가스유량 (sccm)
    rf_power  = Column(Float,   nullable=True)   # RF 파워 (W)

    run = relationship("FdcRun", back_populates="fdc_records")
