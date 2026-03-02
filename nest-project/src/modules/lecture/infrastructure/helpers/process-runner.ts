import { spawn } from 'child_process';

export interface ProcessRunnerOptions {
    command: string;
    args: string[];
    timeoutMs: number;
    cwd?: string;
    stdinData?: string;
    onStderr?: (line: string) => void;
}

export interface ProcessResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}

export function runProcess(options: ProcessRunnerOptions): Promise<ProcessResult> {
    const { command, args, timeoutMs, cwd, stdinData, onStderr } = options;

    return new Promise<ProcessResult>((resolve, reject) => {
        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];

        const child = spawn(command, args, { cwd });

        if (stdinData !== undefined) {
            const ok = child.stdin.write(stdinData);
            if (ok) {
                child.stdin.end();
            } else {
                child.stdin.once('drain', () => {
                    child.stdin.end();
                });
            }
        } else {
            child.stdin.end();
        }

        child.stdin.on('error', () => {
            // stdin 에러 무시 (프로세스가 먼저 종료된 경우)
        });

        const timer = setTimeout(() => {
            child.kill('SIGTERM');
            setTimeout(() => {
                if (!child.killed) {
                    child.kill('SIGKILL');
                }
            }, 5000);
            reject(new Error(`프로세스 타임아웃 (${timeoutMs}ms): ${command}`));
        }, timeoutMs);

        child.stdout.on('data', (chunk: Buffer) => {
            stdoutChunks.push(chunk);
        });

        child.stderr.on('data', (chunk: Buffer) => {
            stderrChunks.push(chunk);
            if (onStderr) {
                const text = chunk.toString('utf-8');
                const lines = text.split('\n').filter((l) => l.trim().length > 0);
                for (const line of lines) {
                    onStderr(line);
                }
            }
        });

        child.on('error', (err: Error) => {
            clearTimeout(timer);
            reject(err);
        });

        child.on('close', (code: number | null) => {
            clearTimeout(timer);
            resolve({
                exitCode: code ?? 1,
                stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
                stderr: Buffer.concat(stderrChunks).toString('utf-8'),
            });
        });
    });
}
