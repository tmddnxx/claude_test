import { SummaryMarkdown } from '../../domain/value-objects/summary-markdown.vo.js';

export interface ISummarizerPort {
    summarize(prompt: string): Promise<SummaryMarkdown>;
}
