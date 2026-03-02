import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { IFileWriterPort } from '../../application/ports/file-writer.port.js';
import { LectureTitle } from '../../domain/value-objects/lecture-title.vo.js';
import { SummaryMarkdown } from '../../domain/value-objects/summary-markdown.vo.js';
import { FileWriteException } from '../../domain/exceptions/file-write.exception.js';

@Injectable()
export class FsFileWriterAdapter implements IFileWriterPort {
    private readonly logger = new Logger(FsFileWriterAdapter.name);

    constructor(private readonly configService: ConfigService) {}

    async write(
        courseTitle: string,
        lectureTitle: LectureTitle,
        content: SummaryMarkdown,
    ): Promise<string> {
        const outputDir = this.configService.get<string>('OUTPUT_DIR', './summarize');
        const sanitizedCourse = courseTitle
            .replace(/[<>:"/\\|?*]+/g, '_')
            .replace(/_+/g, '_')
            .trim();
        const courseDir = resolve(join(outputDir, sanitizedCourse));

        try {
            if (!existsSync(courseDir)) {
                mkdirSync(courseDir, { recursive: true });
            }

            const filePath = join(courseDir, `${lectureTitle.value}.md`);
            writeFileSync(filePath, content.value, 'utf-8');

            this.logger.log(`파일 저장 완료: ${filePath}`);
            return filePath;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            throw new FileWriteException(`파일 저장 실패: ${message}`);
        }
    }
}
