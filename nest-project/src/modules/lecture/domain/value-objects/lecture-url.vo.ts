import { LectureDomainException } from '../exceptions/lecture-domain.exception.js';

export class LectureUrl {
    readonly value: string;

    constructor(url: string) {
        const trimmed = url.trim();
        try {
            new URL(trimmed);
        } catch {
            throw new LectureDomainException(
                'INVALID_LECTURE_URL',
                `유효하지 않은 URL 형식입니다: ${trimmed}`,
            );
        }
        this.value = trimmed;
    }
}
