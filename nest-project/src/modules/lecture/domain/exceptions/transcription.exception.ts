import { LectureDomainException } from './lecture-domain.exception.js';

export class TranscriptionException extends LectureDomainException {
    constructor(message: string) {
        super('TRANSCRIPTION_FAILED', message);
    }
}
