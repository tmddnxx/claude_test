import { LectureDomainException } from '../exceptions/lecture-domain.exception.js';

export class LectureTitle {
    readonly value: string;

    constructor(title: string) {
        const trimmed = title.trim();
        if (trimmed.length === 0) {
            throw new LectureDomainException('EMPTY_LECTURE_TITLE', '강의 제목이 비어있습니다.');
        }
        this.value = trimmed.replace(/[<>:"/\\|?*]+/g, '_').replace(/_+/g, '_');
    }
}
