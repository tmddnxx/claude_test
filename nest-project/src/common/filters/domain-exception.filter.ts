import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { LectureDomainException } from '../../modules/lecture/domain/exceptions/lecture-domain.exception.js';
import { BrowserNavigationException } from '../../modules/lecture/domain/exceptions/browser-navigation.exception.js';
import { AudioExtractionException } from '../../modules/lecture/domain/exceptions/audio-extraction.exception.js';
import { TranscriptionException } from '../../modules/lecture/domain/exceptions/transcription.exception.js';
import { SummarizationException } from '../../modules/lecture/domain/exceptions/summarization.exception.js';
import { FileWriteException } from '../../modules/lecture/domain/exceptions/file-write.exception.js';
import { ApiErrorResponse } from '../types/api-response.type.js';

const EXTERNAL_FAILURE_EXCEPTIONS = [
    BrowserNavigationException,
    AudioExtractionException,
    TranscriptionException,
    SummarizationException,
];

@Catch(LectureDomainException)
export class DomainExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(DomainExceptionFilter.name);

    catch(exception: LectureDomainException, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        const status = this.mapToHttpStatus(exception);

        this.logger.error(`[${exception.code}] ${exception.message}`, exception.stack);

        const body: ApiErrorResponse = {
            success: false,
            error: {
                code: exception.code,
                message: exception.message,
            },
            meta: {
                timestamp: new Date().toISOString(),
            },
        };

        response.status(status).json(body);
    }

    private mapToHttpStatus(exception: LectureDomainException): number {
        if (EXTERNAL_FAILURE_EXCEPTIONS.some((cls) => exception instanceof cls)) {
            return HttpStatus.BAD_GATEWAY;
        }
        if (exception instanceof FileWriteException) {
            return HttpStatus.INTERNAL_SERVER_ERROR;
        }
        return HttpStatus.BAD_REQUEST;
    }
}
