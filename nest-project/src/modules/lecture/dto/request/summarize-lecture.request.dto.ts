import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class SummarizeLectureRequestDto {
    @IsString({ message: '과목 ID는 문자열이어야 합니다.' })
    @IsNotEmpty({ message: '과목 ID는 필수 입력값입니다.' })
    courseId: string;

    @IsInt({ message: '강의 번호는 정수여야 합니다.' })
    @Min(1, { message: '강의 번호는 1 이상이어야 합니다.' })
    lectureNumber: number;
}
