import { LectureDomainException } from '../exceptions/lecture-domain.exception.js';

export class SummaryMarkdown {
    readonly value: string;

    constructor(content: string) {
        if (!content || content.trim().length === 0) {
            throw new LectureDomainException('EMPTY_SUMMARY', '요약 내용이 비어있습니다.');
        }
        this.value = content.trim();
    }
}
