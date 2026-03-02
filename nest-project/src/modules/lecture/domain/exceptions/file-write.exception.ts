import { LectureDomainException } from './lecture-domain.exception.js';

export class FileWriteException extends LectureDomainException {
    constructor(message: string) {
        super('FILE_WRITE_FAILED', message);
    }
}
