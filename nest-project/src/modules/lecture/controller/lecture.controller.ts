import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LecturePipelineService } from '../application/lecture-pipeline.service.js';
import { SummarizeLectureRequestDto } from '../dto/request/summarize-lecture.request.dto.js';
import { LectureSummaryResponseDto } from '../dto/response/lecture-summary.response.dto.js';
import { CourseListResponseDto } from '../dto/response/course-list.response.dto.js';
import { LectureListResponseDto } from '../dto/response/lecture-list.response.dto.js';

@Controller('lecture')
export class LectureController {
    constructor(private readonly lecturePipelineService: LecturePipelineService) {}

    @Get('courses')
    async getCourses(): Promise<CourseListResponseDto[]> {
        const courses = await this.lecturePipelineService.getCourses();
        return courses.map((c) => new CourseListResponseDto(c.courseId, c.title, c.progress));
    }

    @Get('courses/:courseId/lectures')
    async getLectures(@Param('courseId') courseId: string): Promise<LectureListResponseDto[]> {
        const lectures = await this.lecturePipelineService.getLectures(courseId);
        return lectures.map(
            (l) =>
                new LectureListResponseDto(
                    l.lectureIndex,
                    l.title,
                    l.available,
                    l.totalMinutes,
                    l.studiedMinutes,
                ),
        );
    }

    @Post('summarize')
    async summarize(@Body() dto: SummarizeLectureRequestDto): Promise<LectureSummaryResponseDto> {
        const result = await this.lecturePipelineService.execute(dto.courseId, dto.lectureNumber);
        return new LectureSummaryResponseDto(result.filePath, result.lectureTitle);
    }
}
