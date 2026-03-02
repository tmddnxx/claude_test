import { AudioFilePath } from '../../domain/value-objects/audio-file-path.vo.js';
import { StreamUrl } from '../../domain/value-objects/stream-url.vo.js';

export interface IAudioExtractorPort {
    extractAudio(streamUrl: StreamUrl): Promise<AudioFilePath>;
}
