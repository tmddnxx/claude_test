# KNOU Lecture Summarizer

한국방송통신대학교(KNOU) U-캠퍼스 강의를 자동으로 수집하고 요약하는 NestJS 백엔드 프로젝트.

## 주요 기능

- U-캠퍼스 자동 로그인 및 수강 과목 조회
- 과목별 강의 목록 조회 (수강 가능 여부, 진도율 포함)
- 강의 팝업에서 m3u8 스트림 URL 자동 캡처
- 오디오 추출 → 음성 인식(Whisper) → AI 요약(Claude) 파이프라인

## 기술 스택

| 항목 | 버전/도구 |
|------|-----------|
| Runtime | Node.js 20+ |
| Framework | NestJS 11 |
| Language | TypeScript (strict) |
| 브라우저 자동화 | Playwright |
| 음성 인식 | faster-whisper (Python venv) |
| 요약 | Claude API |

## 설치

```bash
cd nest-project

# 의존성 설치
npm install

# Playwright 브라우저 설치
npx playwright install chromium

# Python venv 설정 (faster-whisper)
python3 -m venv ../venv
source ../venv/bin/activate
pip install faster-whisper
```

## 환경변수 설정

`.env` 파일을 프로젝트 루트에 생성:

```env
# 서버
PORT=3000
NODE_ENV=development

# 강의 사이트
LECTURE_LOGIN_URL=https://ucampus.knou.ac.kr/ekp/user/login/retrieveULOLogin.do
LECTURE_STUDY_URL=https://ucampus.knou.ac.kr/ekp/user/study/retrieveUMYStudy.sdo
LECTURE_USERNAME=your_username
LECTURE_PASSWORD=your_password

# 타임아웃 (ms)
BROWSER_TIMEOUT_MS=30000
FFMPEG_TIMEOUT_MS=600000
WHISPER_TIMEOUT_MS=3600000
CLAUDE_TIMEOUT_MS=600000

# Whisper (faster-whisper)
VENV_PATH=../venv
WHISPER_MODEL=small
WHISPER_WORKERS=4
WHISPER_CHUNK_SEC=300

# 출력
OUTPUT_DIR=./summarize
```

## 실행

```bash
# 개발 모드
npm run start:dev

# 프로덕션 빌드
npm run build
npm run start:prod
```

## API 엔드포인트

### 1. 수강 과목 목록 조회

```
GET /lecture/courses
```

**응답 예시:**

```json
{
  "success": true,
  "data": [
    {
      "courseId": "KNOU2593001",
      "title": "데이터베이스시스템",
      "progress": 0
    },
    {
      "courseId": "KNOU2245001",
      "title": "알고리즘",
      "progress": 0
    }
  ]
}
```

### 2. 강의 목록 조회

```
GET /lecture/courses/:courseId/lectures
```

**예시:** `GET /lecture/courses/KNOU2593001/lectures`

**응답 예시:**

```json
{
  "success": true,
  "data": [
    {
      "lectureIndex": 1,
      "title": "1강. 데이터베이스의 이해",
      "available": true,
      "totalMinutes": 73,
      "studiedMinutes": 0
    },
    {
      "lectureIndex": 4,
      "title": "4강. SQL (1)",
      "available": false,
      "totalMinutes": 0,
      "studiedMinutes": 0
    }
  ]
}
```

- `available: true` — 수강 가능 (강의보기 버튼 존재)
- `available: false` — 제작중

### 3. 강의 요약

```
POST /lecture/summarize
Content-Type: application/json

{
  "courseId": "KNOU2593001",
  "lectureNumber": 1
}
```

**응답 예시:**

```json
{
  "success": true,
  "data": {
    "filePath": "./summarize/데이터베이스시스템/1강_데이터베이스의_이해.md",
    "lectureTitle": "1강. 데이터베이스의 이해"
  }
}
```

**파이프라인 순서:**

1. U-캠퍼스 로그인 → 학습현황 페이지 이동
2. 과목 펼치기 → 강의보기 클릭 → 팝업에서 m3u8 URL 캡처
3. FFmpeg로 m3u8 스트림에서 오디오 추출
4. Whisper로 한국어 음성 인식
5. Claude API로 요약 생성
6. 마크다운 파일로 저장

## 프로젝트 구조

```
nest-project/
├── scripts/
│   └── transcribe.py                        # faster-whisper 트랜스크립션 스크립트
├── temp/                                    # 임시 파일 (파이프라인 실행 중 생성, 완료 후 자동 삭제)
│   └── lecture-{uuid}/                      # 요청별 임시 디렉토리
│       └── {uuid}.wav                       # FFmpeg 추출 오디오
├── summarize/                               # 최종 요약 결과물 (OUTPUT_DIR)
│   ├── 데이터베이스시스템/
│   │   ├── 1강_데이터베이스의_이해.md
│   │   ├── 2강_데이터베이스_모델링.md
│   │   └── 3강_관계형_모델.md
│   ├── 알고리즘/
│   │   └── ...
│   └── Java프로그래밍/
│       └── ...
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── filters/                         # 전역 예외 필터
│   │   ├── interceptors/                    # API 응답 포맷 인터셉터
│   │   └── types/                           # 공통 타입
│   └── modules/
│       └── lecture/
│           ├── lecture.module.ts
│           ├── controller/
│           │   └── lecture.controller.ts
│           ├── application/
│           │   ├── lecture-pipeline.service.ts
│           │   └── ports/
│           │       ├── browser.port.ts
│           │       ├── audio-extractor.port.ts
│           │       ├── transcriber.port.ts
│           │       ├── summarizer.port.ts
│           │       └── file-writer.port.ts
│           ├── domain/
│           │   ├── constants/
│           │   ├── exceptions/
│           │   └── value-objects/
│           ├── infrastructure/
│           │   ├── adapters/
│           │   │   ├── playwright-browser.adapter.ts
│           │   │   ├── ffmpeg-audio-extractor.adapter.ts
│           │   │   ├── whisper-transcriber.adapter.ts
│           │   │   ├── claude-summarizer.adapter.ts
│           │   │   └── fs-file-writer.adapter.ts
│           │   └── helpers/
│           │       ├── temp-file-manager.ts
│           │       └── process-runner.ts
│           └── dto/
│               ├── request/
│               │   └── summarize-lecture.request.dto.ts
│               └── response/
│                   ├── lecture-summary.response.dto.ts
│                   ├── course-list.response.dto.ts
│                   └── lecture-list.response.dto.ts
└── .env
```

## 아키텍처

계층형 아키텍처 + DDD 원칙 적용:

```
Controller → Application(Service) → Domain → Infrastructure
```

- **Controller**: HTTP 요청/응답만 처리
- **Application**: 유스케이스 오케스트레이션 (파이프라인 실행)
- **Domain**: 비즈니스 규칙, 값 객체, 예외
- **Infrastructure**: Playwright, FFmpeg, Whisper, Claude API 등 외부 시스템 어댑터

포트-어댑터 패턴으로 외부 의존성을 추상화하여 교체 가능.

## 동작 흐름

```
[사용자] POST /lecture/summarize { courseId, lectureNumber }
    │
    ▼
[LectureController] → DTO 검증
    │
    ▼
[LecturePipelineService] → 파이프라인 오케스트레이션
    │
    ├─ 1. [PlaywrightBrowserAdapter]
    │      로그인 (ucampus.knou.ac.kr)
    │      → 학습현황 페이지 이동
    │      → 과목 펼치기 (btn-toggle 클릭)
    │      → 강의보기 클릭 → 팝업 오픈
    │      → 팝업 네트워크 응답에서 .m3u8 URL 캡처
    │
    ├─ 2. [FfmpegAudioExtractor] → m3u8 → mp3
    │
    ├─ 3. [WhisperTranscriber] → mp3 → 텍스트
    │
    ├─ 4. [ClaudeSummarizer] → 텍스트 → 요약
    │
    └─ 5. [FsFileWriter] → 마크다운 파일 저장
```
