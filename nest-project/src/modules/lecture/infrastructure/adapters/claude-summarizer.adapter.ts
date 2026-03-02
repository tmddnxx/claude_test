import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ISummarizerPort } from '../../application/ports/summarizer.port.js';
import { SummaryMarkdown } from '../../domain/value-objects/summary-markdown.vo.js';
import { SummarizationException } from '../../domain/exceptions/summarization.exception.js';
import { runProcess } from '../helpers/process-runner.js';

@Injectable()
export class ClaudeSummarizerAdapter implements ISummarizerPort {
    private readonly logger = new Logger(ClaudeSummarizerAdapter.name);

    constructor(private readonly configService: ConfigService) {}

    async summarize(prompt: string): Promise<SummaryMarkdown> {
        const timeoutMs = this.configService.get<number>('CLAUDE_TIMEOUT_MS', 120000);

        this.logger.log(`Claude CLI를 통한 요약 시작 (프롬프트: ${prompt.length}자)`);

        const result = await runProcess({
            command: 'claude',
            args: ['-p', '--output-format', 'json'],
            stdinData: prompt,
            timeoutMs,
        });

        if (result.exitCode !== 0) {
            throw new SummarizationException(
                `Claude CLI 실행 실패 (exit code: ${result.exitCode}): ${result.stderr}`,
            );
        }

        const rawOutput = result.stdout.trim();
        if (!rawOutput) {
            throw new SummarizationException('Claude CLI가 빈 응답을 반환했습니다.');
        }

        let summaryText: string;
        let tokenFooter = '';
        try {
            const json = JSON.parse(rawOutput) as Record<string, unknown>;
            this.logger.log(`Claude JSON 키: ${Object.keys(json).join(', ')}`);
            summaryText = String(json['result'] ?? '');
            const usage = (json['usage'] ?? json['modelUsage'] ?? {}) as Record<string, unknown>;
            this.logger.log('사용량: ', usage);
            const inputTokens = usage['input_tokens'] ?? usage['inputTokens'] ?? 0;
            const outputTokens = usage['output_tokens'] ?? usage['outputTokens'] ?? 0;
            tokenFooter =
                `\n\n---\n` +
                `> **Token 사용량** — ` +
                `입력: ${Number(inputTokens).toLocaleString()}토큰 | ` +
                `출력: ${Number(outputTokens).toLocaleString()}토큰 | ` +
                `합계: ${(Number(inputTokens) + Number(outputTokens)).toLocaleString()}토큰`;
            this.logger.log(
                `토큰 사용량 — 입력: ${inputTokens}, 출력: ${outputTokens}`,
            );
        } catch {
            summaryText = rawOutput;
            this.logger.warn('Claude CLI JSON 파싱 실패, 원본 텍스트 사용');
        }

        if (!summaryText) {
            throw new SummarizationException('Claude CLI 요약 결과가 비어있습니다.');
        }

        this.logger.log(`요약 완료 (${summaryText.length}자)`);
        return new SummaryMarkdown(summaryText + tokenFooter);
    }
}
