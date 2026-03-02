import { Module } from '@nestjs/common';
import { LectureController } from './controller/lecture.controller.js';
import { LecturePipelineService } from './application/lecture-pipeline.service.js';
import { PlaywrightBrowserAdapter } from './infrastructure/adapters/playwright-browser.adapter.js';
import { FfmpegAudioExtractorAdapter } from './infrastructure/adapters/ffmpeg-audio-extractor.adapter.js';
import { WhisperTranscriberAdapter } from './infrastructure/adapters/whisper-transcriber.adapter.js';
import { ClaudeSummarizerAdapter } from './infrastructure/adapters/claude-summarizer.adapter.js';
import { FsFileWriterAdapter } from './infrastructure/adapters/fs-file-writer.adapter.js';
import { TempFileManager } from './infrastructure/helpers/temp-file-manager.js';
import {
    BROWSER_PORT,
    AUDIO_EXTRACTOR_PORT,
    TRANSCRIBER_PORT,
    SUMMARIZER_PORT,
    FILE_WRITER_PORT,
} from './domain/constants/injection-tokens.js';

@Module({
    controllers: [LectureController],
    providers: [
        LecturePipelineService,
        TempFileManager,
        {
            provide: BROWSER_PORT,
            useClass: PlaywrightBrowserAdapter,
        },
        {
            provide: AUDIO_EXTRACTOR_PORT,
            useClass: FfmpegAudioExtractorAdapter,
        },
        {
            provide: TRANSCRIBER_PORT,
            useClass: WhisperTranscriberAdapter,
        },
        {
            provide: SUMMARIZER_PORT,
            useClass: ClaudeSummarizerAdapter,
        },
        {
            provide: FILE_WRITER_PORT,
            useClass: FsFileWriterAdapter,
        },
    ],
})
export class LectureModule {}
