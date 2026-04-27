"""
실제 테스트용 샘플 CSV 생성 스크립트
python generate_sample_csv.py 실행하면 sample_lot0421.csv 생성
"""
import csv, math, random

random.seed(42)

MAX_CYCLE = 100
BASE_RATE = 0.065  # nm/cycle

# 49포인트 좌표 생성
def build_49pts():
    pts = []
    rings = [(0,1),(0.19,6),(0.39,10),(0.58,14),(0.78,12),(0.97,6)]
    for r, n in rings:
        for i in range(n):
            a = 2 * math.pi * i / n - math.pi / 2
            pts.append((round(r*math.cos(a),4), round(r*math.sin(a),4), r))
    return pts[:49]

pts = build_49pts()

# 포인트별 고정 랜덤 오프셋
seed_rates = [random.gauss(0, 0.002) for _ in pts]

def thickness(idx, cycle):
    r = pts[idx][2]
    rate = BASE_RATE * (1 + (1 - r) * 0.12 - r * 0.08) + seed_rates[idx]
    total = 0
    for c in range(1, cycle + 1):
        # 드리프트: 선형 안정화 (사인파 없음)
        drift = 0.86 + min(c, 10) * 0.014 if c < 10 else 1.0 + min(c - 10, 40) * 0.0008
        total += rate * drift
    return round(total + random.gauss(0, 0.001), 4)

def fdc_params(cycle):
    # 온도: 약간의 드리프트 + 작은 노이즈
    temp     = 362.0 + cycle * 0.01 + random.gauss(0, 0.3)
    pressure = 48.0  + cycle * 0.005 + random.gauss(0, 0.2)
    gas_flow = 120.0 - cycle * 0.002 + random.gauss(0, 0.1)
    rf_power = 300.0 + random.gauss(0, 1.0)
    return round(temp,2), round(pressure,2), round(gas_flow,2), round(rf_power,1)

# 롱 포맷으로 저장
with open("sample_lot0421.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["cycle","point_idx","thickness_nm","temp_c","pressure","gas_flow","rf_power"])
    for cycle in range(1, MAX_CYCLE + 1):
        temp, pres, gas, rf = fdc_params(cycle)
        for idx in range(49):
            writer.writerow([cycle, idx, thickness(idx, cycle), temp, pres, gas, rf])

print(f"생성 완료: sample_lot0421.csv ({MAX_CYCLE * 49} rows)")
