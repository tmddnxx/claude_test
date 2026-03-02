# m3u8 캡처 개선 설계

## 문제

팝업 페이지에 여러 영상(인트로, 광고, 메인 강의)이 존재할 수 있으며, 현재 구현은 마지막으로 매칭된 `.m3u8` URL을 무차별 사용한다. 이로 인해 잘못된 스트림이 캡처될 수 있다.

## 해결 방향

JW Player API를 1차로 사용하고, 실패 시 duration 기반 폴백을 적용한다.

## 변경 범위

- `playwright-browser.adapter.ts` — `clickAndCaptureM3u8` 메서드만 수정
- 포트 인터페이스, 파이프라인 등 변경 없음

## 동작 흐름

```
팝업 열림
  ├─ 네트워크 감시: 모든 .m3u8 URL을 배열에 수집
  ├─ networkidle 대기
  ├─ 1차: jwplayer().getPlaylistItem().file → 성공 시 반환
  ├─ 2차: 수집된 m3u8 각각 fetch → #EXTINF 합계로 duration 비교 → 가장 긴 것 반환
  └─ 3차: 수집된 m3u8 중 마지막 것 반환 (기존 동작)
```

## 구현 상세

1. `capturedUrl: string | null` → `capturedUrls: string[]` (중복 제거)
2. JW Player API: `page.evaluate(() => jwplayer().getPlaylistItem().file)` — try/catch
3. Duration 폴백: 팝업 페이지 컨텍스트에서 각 m3u8을 fetch, `#EXTINF:` 값 합산, 가장 긴 URL 선택
4. 최종 폴백: 배열 마지막 URL

## 성능

- JW Player API 성공 시: 추가 HTTP 0개, JS 평가 1회
- Duration 폴백 시: m3u8 개수만큼 HTTP 추가 (3~5개, 수초)
