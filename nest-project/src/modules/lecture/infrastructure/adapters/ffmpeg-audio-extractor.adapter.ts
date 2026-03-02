import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAudioExtractorPort } from '../../application/ports/audio-extractor.port.js';
import { StreamUrl } from '../../domain/value-objects/stream-url.vo.js';
import { AudioFilePath } from '../../domain/value-objects/audio-file-path.vo.js';
import { AudioExtractionException } from '../../domain/exceptions/audio-extraction.exception.js';
import { TempFileManager } from '../helpers/temp-file-manager.js';
import { runProcess } from '../helpers/process-runner.js';

@Injectable()
export class FfmpegAudioExtractorAdapter implements IAudioExtractorPort {
    private readonly logger = new Logger(FfmpegAudioExtractorAdapter.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly tempFileManager: TempFileManager,
    ) {}

    async extractAudio(streamUrl: StreamUrl): Promise<AudioFilePath> {
        const outputPath = this.tempFileManager.createTempPath('.wav');
        const timeoutMs = this.configService.get<number>('FFMPEG_TIMEOUT_MS', 600000);

        this.logger.log(`오디오 추출 시작: ${streamUrl.value}`);
        const result = await runProcess({
            command: 'ffmpeg',
            args: [
                '-i',
                streamUrl.value,
                '-vn',
                '-acodec',
                'pcm_s16le',
                '-ar',
                '16000',
                '-ac',
                '1',
                '-y',
                outputPath,
            ],
            timeoutMs,
        });

        if (result.exitCode !== 0) {
            throw new AudioExtractionException(
                `ffmpeg 실행 실패 (exit code: ${result.exitCode}): ${result.stderr}`,
            );
        }

        this.logger.log(`오디오 추출 완료: ${outputPath}`);
        return new AudioFilePath(outputPath);
    }
}
