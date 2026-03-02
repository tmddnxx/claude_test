import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class LectureListResponseDto {
    @Expose()
    lectureIndex: number;

    @Expose()
    title: string;

    @Expose()
    available: boolean;

    @Expose()
    totalMinutes: number;

    @Expose()
    studiedMinutes: number;

    constructor(
        lectureIndex: number,
        title: string,
        available: boolean,
        totalMinutes: number,
        studiedMinutes: number,
    ) {
        this.lectureIndex = lectureIndex;
        this.title = title;
        this.available = available;
        this.totalMinutes = totalMinutes;
        this.studiedMinutes = studiedMinutes;
    }
}
