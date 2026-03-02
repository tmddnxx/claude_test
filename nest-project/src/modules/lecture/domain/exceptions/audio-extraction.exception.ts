import { LectureDomainException } from './lecture-domain.exception.js';

export class AudioExtractionException extends LectureDomainException {
    constructor(message: string) {
        super('AUDIO_EXTRACTION_FAILED', message);
    }
}
