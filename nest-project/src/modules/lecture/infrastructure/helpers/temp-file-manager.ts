import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

export class TempFileManager {
    private readonly baseDir: string;
    private tempDir: string | null = null;

    constructor() {
        this.baseDir = join(process.cwd(), 'temp');
    }

    createTempPath(extension: string): string {
        if (!this.tempDir || !existsSync(this.tempDir)) {
            this.tempDir = this.createTempDir();
        }
        const filename = `${randomUUID()}${extension}`;
        return join(this.tempDir, filename);
    }

    cleanup(): void {
        if (this.tempDir && existsSync(this.tempDir)) {
            rmSync(this.tempDir, { recursive: true, force: true });
            this.tempDir = null;
        }
    }

    private createTempDir(): string {
        const dir = join(this.baseDir, `lecture-${randomUUID().slice(0, 8)}`);
        mkdirSync(dir, { recursive: true });
        return dir;
    }
}
