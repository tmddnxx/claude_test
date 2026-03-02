import { LectureDomainException } from './lecture-domain.exception.js';

export class BrowserNavigationException extends LectureDomainException {
    constructor(message: string) {
        super('BROWSER_NAVIGATION_FAILED', message);
    }
}
