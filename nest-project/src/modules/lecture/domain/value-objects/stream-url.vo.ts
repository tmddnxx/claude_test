import { LectureDomainException } from '../exceptions/lecture-domain.exception.js';

export class StreamUrl {
    readonly value: string;

    constructor(url: string) {
        const trimmed = url.trim();
        if (!trimmed.includes('.m3u8')) {
            throw new LectureDomainException(
                'INVALID_STREAM_URL',
                `m3u8 스트림 URL이 아닙니다: ${trimmed}`,
            );
        }
        this.value = trimmed;
    }
}
