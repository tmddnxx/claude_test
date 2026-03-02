import { LectureDomainException } from '../exceptions/lecture-domain.exception.js';

export class Transcript {
    readonly value: string;

    constructor(text: string) {
        if (!text || text.trim().length === 0) {
            throw new LectureDomainException('EMPTY_TRANSCRIPT', '트랜스크립트가 비어있습니다.');
        }
        this.value = text.trim();
    }
}
