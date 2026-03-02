import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { IBrowserPort, CourseInfo, LectureInfo } from './ports/browser.port.js';
import type { IAudioExtractorPort } from './ports/audio-extractor.port.js';
import type { ITranscriberPort } from './ports/transcriber.port.js';
import type { ISummarizerPort } from './ports/summarizer.port.js';
import type { IFileWriterPort } from './ports/file-writer.port.js';
import {
    BROWSER_PORT,
    AUDIO_EXTRACTOR_PORT,
    TRANSCRIBER_PORT,
    SUMMARIZER_PORT,
    FILE_WRITER_PORT,
} from '../domain/constants/injection-tokens.js';
import { TempFileManager } from '../infrastructure/helpers/temp-file-manager.js';

export interface PipelineResult {
    filePath: string;
    lectureTitle: string;
}

@Injectable()
export class LecturePipelineService {
    private readonly logger = new Logger(LecturePipelineService.name);

    constructor(
        @Inject(BROWSER_PORT) private readonly browser: IBrowserPort,
        @Inject(AUDIO_EXTRACTOR_PORT) private readonly audioExtractor: IAudioExtractorPort,
        @Inject(TRANSCRIBER_PORT) private readonly transcriber: ITranscriberPort,
        @Inject(SUMMARIZER_PORT) private readonly summarizer: ISummarizerPort,
        @Inject(FILE_WRITER_PORT) private readonly fileWriter: IFileWriterPort,
        private readonly tempFileManager: TempFileManager,
        private readonly configService: ConfigService,
    ) {}

    private buildPrompt(transcript: string): string {
        return `다음은 대학 강의 트랜스크립트입니다. 아래 형식에 맞춰 마크다운으로 요약해 주세요.

## 요약 형식

### 1. 전체 개요
- 강의의 주제와 흐름을 2-3문장으로 요약

### 2. 핵심 개념
- 강의에서 다룬 주요 개념을 불릿 포인트로 정리

### 3. 중요 정의
- 시험에 나올 수 있는 정의나 공식을 정리

### 4. 시험 예상 포인트
- 시험에 출제될 가능성이 높은 내용을 정리

### 5. 한 페이지 요약
- 전체 내용을 한 페이지 분량으로 압축 요약

---

## 트랜스크립트

${transcript}`;
    }

    private savePromptFile(courseTitle: string, lectureTitleValue: string, prompt: string): void {
        const outputDir = this.configService.get<string>('OUTPUT_DIR', './summarize');
        const sanitizedCourse = courseTitle
            .replace(/[<>:"/\\|?*]+/g, '_')
            .replace(/_+/g, '_')
            .trim();
        const dir = join(outputDir, sanitizedCourse);

        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }

        const promptPath = join(dir, `${lectureTitleValue}_prompt.md`);
        writeFileSync(promptPath, prompt, 'utf-8');
        this.logger.log(`프롬프트 파일 저장: ${promptPath}`);
    }

    async getCourses(): Promise<CourseInfo[]> {
        return this.browser.fetchCourses();
    }

    async getLectures(courseId: string): Promise<LectureInfo[]> {
        return this.browser.fetchLectures(courseId);
    }

    async execute(courseId: string, lectureNumber: number): Promise<PipelineResult> {
        this.logger.log(`파이프라인 시작: 과목 ${courseId}, ${lectureNumber}강`);

        try {
            this.logger.log('1단계: 스트림 URL 캡처');
            const { streamUrl, courseTitle, lectureTitle } = await this.browser.captureStreamUrl(
                courseId,
                lectureNumber,
            );

            this.logger.log('2단계: 오디오 추출');
            const audioPath = await this.audioExtractor.extractAudio(streamUrl);

            this.logger.log('3단계: 트랜스크립션');
            const transcript = await this.transcriber.transcribe(audioPath, 'ko');

            this.logger.log('4단계: 프롬프트 구성 및 저장');
            const prompt = this.buildPrompt(transcript.value);
            this.savePromptFile(courseTitle, lectureTitle.value, prompt);

            this.logger.log('5단계: 요약 생성');
            const summary = await this.summarizer.summarize(prompt);

            this.logger.log('6단계: 요약 파일 저장');
            const filePath = await this.fileWriter.write(courseTitle, lectureTitle, summary);

            this.logger.log(`파이프라인 완료: ${filePath}`);
            return { filePath, lectureTitle: lectureTitle.value };
        } finally {
            await Promise.allSettled([
                this.browser.dispose(),
                Promise.resolve(this.tempFileManager.cleanup()),
            ]);
            this.logger.log('리소스 정리 완료');
        }
    }
}
