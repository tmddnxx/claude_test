import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class LectureSummaryResponseDto {
    @Expose()
    filePath: string;

    @Expose()
    lectureTitle: string;

    constructor(filePath: string, lectureTitle: string) {
        this.filePath = filePath;
        this.lectureTitle = lectureTitle;
    }
}
