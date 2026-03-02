# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 1. 프로젝트 개요

**KNOU Lecture Summarizer** — 한국방송통신대학교(KNOU) U-캠퍼스 강의를 자동으로 수집하고 요약하는 NestJS 백엔드.
Playwright로 U-캠퍼스에 로그인하여 강의 영상의 m3u8 스트림 URL을 캡처하고, FFmpeg → faster-whisper → Claude CLI 파이프라인으로 오디오 추출 → 음성 인식 → 요약 마크다운 생성까지 자동 처리한다.

**모든 명령어는 `nest-project/` 디렉토리에서 실행한다.**

## 2. 기술 스택

| 항목 | 버전/도구 |
|------|-----------|
| Runtime | Node.js 20+ |
| Framework | NestJS 11 |
| Language | TypeScript (strict) |
| 브라우저 자동화 | Playwright (Chromium) |
| 오디오 추출 | FFmpeg (m3u8 → WAV, 16kHz mono) |
| 음성 인식 | faster-whisper (Python venv, `scripts/transcribe.py`) |
| 요약 | Claude CLI (`claude -p`) |
| Validation | class-validator, class-transformer |

**DB 없음** — 현재 데이터베이스를 사용하지 않는다. 결과물은 파일시스템(`./summarize/`)에 마크다운으로 저장한다.

## 3. 파이프라인 동작 흐름

```
POST /lecture/summarize { courseId, lectureNumber }
    │
    ├─ 1. PlaywrightBrowserAdapter
    │     로그인(ucampus) → 학습현황 → 과목 펼치기 → 강의보기 클릭
    │     → 팝업에서 .m3u8 URL 캡처 (네트워크 응답 감시)
    │
    ├─ 2. FfmpegAudioExtractorAdapter
    │     m3u8 스트림 → WAV (pcm_s16le, 16kHz, mono)
    │     임시 파일: ./temp/lecture-{uuid}/{uuid}.wav
    │
    ├─ 3. WhisperTranscriberAdapter
    │     Python venv의 faster-whisper 호출 (scripts/transcribe.py)
    │     stderr 진행률 → NestJS 로그로 실시간 출력
    │
    ├─ 4. ClaudeSummarizerAdapter
    │     `claude -p` CLI로 트랜스크립트 요약
    │
    └─ 5. FsFileWriterAdapter
          ./summarize/{과목명}/{강의제목}.md 저장
```

## 4. 아키텍처

**계층형 + 포트-어댑터(헥사고날) 패턴**

```
Controller → Application(Service) → Domain → Infrastructure
```

- **Controller**: HTTP 요청/응답만 처리. 비즈니스 로직 금지.
- **Application**: 파이프라인 오케스트레이션 (`LecturePipelineService`).
- **Domain**: 값 객체(VO), 커스텀 예외, DI 토큰. 프레임워크 무의존.
- **Infrastructure**: Playwright, FFmpeg, Whisper, Claude, 파일시스템 어댑터.

**포트(인터페이스) → 어댑터(구현체)** 패턴으로 외부 의존성을 추상화:

| 포트 (application/ports/) | 어댑터 (infrastructure/adapters/) | DI 토큰 |
|---------------------------|-----------------------------------|---------|
| `IBrowserPort` | `PlaywrightBrowserAdapter` | `BROWSER_PORT` |
| `IAudioExtractorPort` | `FfmpegAudioExtractorAdapter` | `AUDIO_EXTRACTOR_PORT` |
| `ITranscriberPort` | `WhisperTranscriberAdapter` | `TRANSCRIBER_PORT` |
| `ISummarizerPort` | `ClaudeSummarizerAdapter` | `SUMMARIZER_PORT` |
| `IFileWriterPort` | `FsFileWriterAdapter` | `FILE_WRITER_PORT` |

DI 토큰은 `domain/constants/injection-tokens.ts`에서 `Symbol()`로 정의한다.

## 5. 폴더 구조

```
nest-project/
├── scripts/
│   └── transcribe.py                        # faster-whisper 트랜스크립션 (Python)
├── temp/                                    # 파이프라인 실행 중 임시 파일 (자동 삭제)
│   └── lecture-{uuid}/
│       └── {uuid}.wav
├── summarize/                               # 최종 요약 결과물 (OUTPUT_DIR)
│   ├── 데이터베이스시스템/
│   │   └── 1강_데이터베이스의_이해.md
│   └── 알고리즘/
│       └── ...
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── filters/                         # 전역 예외 필터
│   │   ├── interceptors/                    # API 응답 포맷 인터셉터
│   │   └── types/
│   └── modules/
│       └── lecture/
│           ├── lecture.module.ts
│           ├── controller/
│           │   └── lecture.controller.ts
│           ├── application/
│           │   ├── lecture-pipeline.service.ts
│           │   └── ports/                   # 포트 인터페이스 5개
│           ├── domain/
│           │   ├── constants/               # injection-tokens.ts (Symbol DI 토큰)
│           │   ├── exceptions/              # 도메인 예외 6개
│           │   └── value-objects/           # VO 6개 (StreamUrl, AudioFilePath, Transcript 등)
│           ├── infrastructure/
│           │   ├── adapters/                # 어댑터 구현체 5개
│           │   └── helpers/
│           │       ├── temp-file-manager.ts # 프로젝트 상대 경로 ./temp/ 사용
│           │       └── process-runner.ts    # spawn 래퍼 (타임아웃, onStderr 콜백)
│           └── dto/
│               ├── request/
│               └── response/
└── .env
```

## 6. API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/lecture/courses` | 수강 과목 목록 조회 |
| `GET` | `/lecture/courses/:courseId/lectures` | 과목별 강의 목록 조회 |
| `POST` | `/lecture/summarize` | 강의 요약 실행 (body: `{ courseId, lectureNumber }`) |

## 7. 환경변수 (.env)

```env
PORT=3000
NODE_ENV=development

# KNOU U-캠퍼스
LECTURE_LOGIN_URL=https://ucampus.knou.ac.kr/ekp/user/login/retrieveULOLogin.do
LECTURE_STUDY_URL=https://ucampus.knou.ac.kr/ekp/user/study/retrieveUMYStudy.sdo
LECTURE_USERNAME=<학번>
LECTURE_PASSWORD=<비밀번호>

# 타임아웃 (ms)
BROWSER_TIMEOUT_MS=30000
FFMPEG_TIMEOUT_MS=600000
WHISPER_TIMEOUT_MS=3600000      # 1시간 (긴 강의 대비)
CLAUDE_TIMEOUT_MS=120000

# faster-whisper
VENV_PATH=../venv                # Python venv 경로 (nest-project 기준 상대경로)
WHISPER_MODEL=small              # tiny/base/small/medium/large-v3

# 출력
OUTPUT_DIR=./summarize
```

`ConfigService`를 통해서만 접근한다 (`process.env` 직접 참조 금지, `main.ts` 제외).

## 8. 핵심 구현 상세

### KNOU 로그인 (PlaywrightBrowserAdapter)
- URL: `LECTURE_LOGIN_URL` (ucampus.knou.ac.kr)
- 폼 필드: `#username`, `#password`
- 로그인 트리거: `page.evaluate(() => actionLogin())` — JS 함수 호출
- **주의**: 로그인 시 페이지 네비게이션이 발생하므로 `Promise.all([waitForNavigation, evaluate])` 패턴 필수

### m3u8 캡처
- 과목 펼치기: `#btn-toggle-{courseId}` 클릭
- 강의보기 클릭 → 팝업 열림 (`context.once('page')`)
- 팝업의 네트워크 응답에서 `.m3u8` URL 감시
- 제작중인 강의는 `span.con-waiting` 존재 여부로 판단

### faster-whisper 연동
- `scripts/transcribe.py`를 Python venv 바이너리로 실행
- `process-runner.ts`의 `onStderr` 콜백으로 진행률 실시간 로깅
- VAD 필터 활성화, 모델은 `WHISPER_MODEL` 환경변수로 제어

### 임시 파일 관리 (TempFileManager)
- NestJS 싱글턴 — 프로젝트 상대 경로 `./temp/lecture-{uuid}/` 사용
- `cleanup()` 후에도 `createTempPath()` 호출 시 디렉토리 자동 재생성
- 파이프라인 완료 후 `finally` 블록에서 자동 정리

## 9. 코딩 컨벤션

- **Prettier**: 작은따옴표, trailing comma `all`, 4칸 들여쓰기
- **ESLint**: flat config (`eslint.config.mjs`)
- `any` 타입 사용 금지
- `async/await`만 사용 (콜백, `.then()` 금지)
- 한 파일에 하나의 클래스
- 포트 인터페이스는 `import type`으로 임포트 (decorated constructor parameter + `isolatedModules` 호환)

### 네이밍 컨벤션

| 대상 | 규칙 | 예시 |
|------|------|------|
| 클래스 | PascalCase | `LecturePipelineService` |
| 파일 | kebab-case | `lecture-pipeline.service.ts` |
| 변수/함수 | camelCase | `fetchCourses` |
| 환경변수 | UPPER_SNAKE_CASE | `WHISPER_MODEL` |
| 인터페이스 | `I` 접두사 | `IBrowserPort` |
| DTO | `{Action}{Domain}{Request/Response}Dto` | `SummarizeLectureRequestDto` |
| 값 객체 파일 | `{name}.vo.ts` | `stream-url.vo.ts` |
| 예외 파일 | `{name}.exception.ts` | `transcription.exception.ts` |

## 10. 빌드 및 실행

```bash
cd nest-project

# 의존성 설치
npm install
npx playwright install chromium

# Python venv (faster-whisper)
python3 -m venv ../venv
source ../venv/bin/activate
pip install faster-whisper

# 개발 모드
npm run start:dev

# 프로덕션
npm run build
npm run start:prod
```

## 11. 알려진 주의사항

- **FFmpeg, Claude CLI** 가 시스템 PATH에 있어야 한다.
- Whisper `large-v3` 모델은 1시간 강의 기준 매우 오래 걸림 → `small` 모델 권장.
- `TempFileManager`는 싱글턴이므로 동시 요청 시 temp 디렉토리 충돌 가능성 있음.
- Playwright는 headless 모드로 실행 — U-캠퍼스 구조 변경 시 셀렉터 업데이트 필요.
- `scripts/transcribe.py`의 `batch_size=8`은 RAM 16GB 기준 적절. GPU 없으면 `compute_type="int8"` 사용.

## 12. 금지 사항

- Controller에 비즈니스 로직 작성
- Domain 계층에서 NestJS 프레임워크 직접 의존
- `any` 타입 사용
- `process.env` 직접 참조 (`main.ts` 제외)
- 콜백 또는 `.then()` 체인
- Infrastructure 계층 외부에서 외부 시스템 직접 호출
- rm -rf 등 동의 없는 삭제
