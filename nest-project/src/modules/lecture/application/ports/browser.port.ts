import { LectureTitle } from '../../domain/value-objects/lecture-title.vo.js';
import { StreamUrl } from '../../domain/value-objects/stream-url.vo.js';

export interface CourseInfo {
    courseId: string;
    title: string;
    progress: number;
}

export interface LectureInfo {
    lectureIndex: number;
    title: string;
    available: boolean;
    totalMinutes: number;
    studiedMinutes: number;
}

export interface CaptureResult {
    streamUrl: StreamUrl;
    courseTitle: string;
    lectureTitle: LectureTitle;
}

export interface IBrowserPort {
    fetchCourses(): Promise<CourseInfo[]>;
    fetchLectures(courseId: string): Promise<LectureInfo[]>;
    captureStreamUrl(courseId: string, lectureIndex: number): Promise<CaptureResult>;
    dispose(): Promise<void>;
}
