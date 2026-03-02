# Whisper 트랜스크립션 성능 최적화 설계

**날짜**: 2026-03-02
**상태**: 승인됨 / 구현 완료

## 문제

- 1시간 강의 트랜스크립션에 약 27분 소요
- 워커 수를 4→8로 늘려도 성능 향상 없음 (CPU 코어 포화)
- 8코어 Mac에서 whisper 워커가 멀티스레드를 사용하여 코어 경합 발생

## 선택한 접근: distil-large-v3 + cpu_threads 제한

### 변경 사항

1. **Whisper 모델 변경**: `small` → `distil-large-v3`
   - large-v3 대비 6배 빠른 추론 속도
   - WER(Word Error Rate) 1% 이내 차이로 품질 유지
   - 한국어 지원 포함

2. **cpu_threads=2 설정**: 워커당 스레드를 2개로 제한
   - 8코어 Mac 기준 4워커 × 2스레드 = 8스레드로 코어 수에 맞춤
   - 워커 간 스레드 경합 해소

3. **워커 수 조정**: `WHISPER_WORKERS=2`
   - distil 모델이 더 많은 메모리 사용 (~1.5GB/워커)
   - 2워커 × 2스레드 = 4스레드, 안정적 운영

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `scripts/transcribe.py` | `WhisperModel()` 호출 3곳에 `cpu_threads=2` 추가 |
| `.env` | `WHISPER_MODEL=distil-large-v3`, `WHISPER_WORKERS=2` |

### 예상 효과

- 기존 27분 → 약 5~10분으로 단축 (distil 모델의 6배 속도 향상)
- CPU 사용률 안정화 (스레드 경합 해소)
- 품질 저하 최소화 (large-v3 대비 97% 수준)

### 기각된 대안

- **tiny 모델**: 가장 빠르지만 한국어 품질 부족
- **워커 수만 증가**: CPU 코어 포화로 효과 없음 (이미 검증됨)
