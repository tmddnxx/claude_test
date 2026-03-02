import { LectureTitle } from '../../domain/value-objects/lecture-title.vo.js';
import { SummaryMarkdown } from '../../domain/value-objects/summary-markdown.vo.js';

export interface IFileWriterPort {
    write(
        courseTitle: string,
        lectureTitle: LectureTitle,
        content: SummaryMarkdown,
    ): Promise<string>;
}
