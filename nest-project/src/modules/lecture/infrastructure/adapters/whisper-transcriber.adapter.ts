import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { ITranscriberPort } from '../../application/ports/transcriber.port.js';
import { AudioFilePath } from '../../domain/value-objects/audio-file-path.vo.js';
import { Transcript } from '../../domain/value-objects/transcript.vo.js';
import { TranscriptionException } from '../../domain/exceptions/transcription.exception.js';
import { runProcess } from '../helpers/process-runner.js';

@Injectable()
export class WhisperTranscriberAdapter implements ITranscriberPort {
    private readonly logger = new Logger(WhisperTranscriberAdapter.name);

    constructor(private readonly configService: ConfigService) {}

    async transcribe(audioPath: AudioFilePath, language: string): Promise<Transcript> {
        const timeoutMs = this.configService.get<number>('WHISPER_TIMEOUT_MS', 600000);
        const model = this.configService.get<string>('WHISPER_MODEL', 'small');
        const workers = this.configService.get<number>('WHISPER_WORKERS', 4);
        const chunkSec = this.configService.get<number>('WHISPER_CHUNK_SEC', 300);
        const venvPath = this.configService.get<string>('VENV_PATH', '');
        const scriptPath = join(process.cwd(), 'scripts', 'transcribe.py');

        const pythonBin = venvPath ? join(process.cwd(), venvPath, 'bin', 'python3') : 'python3';

        this.logger.log(`트랜스크립션 시작: ${audioPath.value} (model: ${model}, workers: ${workers})`);

        const result = await runProcess({
            command: pythonBin,
            args: [
                scriptPath, audioPath.value,
                '--language', language,
                '--model', model,
                '--workers', String(workers),
                '--chunk-sec', String(chunkSec),
            ],
            timeoutMs,
            onStderr: (line) => this.logger.log(line),
        });

        if (result.exitCode !== 0) {
            throw new TranscriptionException(
                `faster-whisper 실행 실패 (exit code: ${result.exitCode}): ${result.stderr}`,
            );
        }

        const text = result.stdout.trim();
        if (text.length === 0) {
            throw new TranscriptionException('트랜스크립션 결과가 비어있습니다.');
        }

        this.logger.log(`트랜스크립션 완료 (${text.length}자)`);
        return new Transcript(text);
    }
}
