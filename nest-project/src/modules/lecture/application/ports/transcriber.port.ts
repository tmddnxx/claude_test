import { AudioFilePath } from '../../domain/value-objects/audio-file-path.vo.js';
import { Transcript } from '../../domain/value-objects/transcript.vo.js';

export interface ITranscriberPort {
    transcribe(audioPath: AudioFilePath, language: string): Promise<Transcript>;
}
