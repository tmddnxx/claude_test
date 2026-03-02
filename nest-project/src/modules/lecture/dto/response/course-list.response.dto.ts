import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class CourseListResponseDto {
    @Expose()
    courseId: string;

    @Expose()
    title: string;

    @Expose()
    progress: number;

    constructor(courseId: string, title: string, progress: number) {
        this.courseId = courseId;
        this.title = title;
        this.progress = progress;
    }
}
