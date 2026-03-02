import { LectureDomainException } from './lecture-domain.exception.js';

export class SummarizationException extends LectureDomainException {
    constructor(message: string) {
        super('SUMMARIZATION_FAILED', message);
    }
}
