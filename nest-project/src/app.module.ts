import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { LectureModule } from './modules/lecture/lecture.module.js';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        LectureModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
