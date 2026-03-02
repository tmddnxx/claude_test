import { LectureDomainException } from '../exceptions/lecture-domain.exception.js';

export class AudioFilePath {
    readonly value: string;

    constructor(path: string) {
        const trimmed = path.trim();
        if (!trimmed.endsWith('.wav')) {
            throw new LectureDomainException(
                'INVALID_AUDIO_PATH',
                `WAV 파일 경로가 아닙니다: ${trimmed}`,
            );
        }
        this.value = trimmed;
    }
}
