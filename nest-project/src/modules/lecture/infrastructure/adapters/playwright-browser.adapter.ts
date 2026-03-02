import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import {
    IBrowserPort,
    CaptureResult,
    CourseInfo,
    LectureInfo,
} from '../../application/ports/browser.port.js';
import { StreamUrl } from '../../domain/value-objects/stream-url.vo.js';
import { LectureTitle } from '../../domain/value-objects/lecture-title.vo.js';
import { BrowserNavigationException } from '../../domain/exceptions/browser-navigation.exception.js';

@Injectable()
export class PlaywrightBrowserAdapter implements IBrowserPort {
    private readonly logger = new Logger(PlaywrightBrowserAdapter.name);
    private browser: Browser | null = null;

    constructor(private readonly configService: ConfigService) {}

    async fetchCourses(): Promise<CourseInfo[]> {
        let localBrowser: Browser | null = null;
        try {
            localBrowser = await chromium.launch({ headless: true });
            const context = await localBrowser.newContext();
            const page = await context.newPage();
            const timeoutMs = this.configService.get<number>('BROWSER_TIMEOUT_MS', 30000);

            await this.login(page, timeoutMs);
            await this.navigateToStudyPage(page, timeoutMs);

            const courseElements = page.locator('.lecture-progress-item');
            const count = await courseElements.count();

            const courses: CourseInfo[] = [];
            for (let i = 0; i < count; i++) {
                const el = courseElements.nth(i);
                const rawId = await el.getAttribute('id');
                const courseId = rawId?.replace('lecture-', '') ?? '';
                const title = (await el.locator('.lecture-title.ellipsis a').textContent()) ?? '';
                const progressText = (await el.locator('.lecture-per .value').textContent()) ?? '0';
                const progress = parseInt(progressText, 10);

                courses.push({ courseId, title: title.trim(), progress });
            }

            this.logger.log(`과목 ${courses.length}개 조회 완료`);
            return courses;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            throw new BrowserNavigationException(`과목 목록 조회 실패: ${message}`);
        } finally {
            if (localBrowser) {
                await localBrowser.close();
            }
        }
    }

    async fetchLectures(courseId: string): Promise<LectureInfo[]> {
        let localBrowser: Browser | null = null;
        try {
            localBrowser = await chromium.launch({ headless: true });
            const context = await localBrowser.newContext();
            const page = await context.newPage();
            const timeoutMs = this.configService.get<number>('BROWSER_TIMEOUT_MS', 30000);

            await this.login(page, timeoutMs);
            await this.navigateToStudyPage(page, timeoutMs);
            await this.expandCourse(page, courseId, timeoutMs);

            const lectures = await this.parseLectureList(page, courseId);
            this.logger.log(`과목 ${courseId}: 강의 ${lectures.length}개 조회 완료`);
            return lectures;
        } catch (error: unknown) {
            if (error instanceof BrowserNavigationException) throw error;
            const message = error instanceof Error ? error.message : String(error);
            throw new BrowserNavigationException(`강의 목록 조회 실패: ${message}`);
        } finally {
            if (localBrowser) {
                await localBrowser.close();
            }
        }
    }

    async captureStreamUrl(courseId: string, lectureIndex: number): Promise<CaptureResult> {
        try {
            this.browser = await chromium.launch({ headless: true });
            const context = await this.browser.newContext();
            const page = await context.newPage();
            const timeoutMs = this.configService.get<number>('BROWSER_TIMEOUT_MS', 30000);

            await this.login(page, timeoutMs);
            await this.navigateToStudyPage(page, timeoutMs);
            await this.expandCourse(page, courseId, timeoutMs);

            const lectureItems = page.locator(`#lecture-${courseId} .lecture-list > li`);
            const lectureItem = lectureItems.nth(lectureIndex - 1);

            const waitingSpan = lectureItem.locator('span.con-waiting');
            if ((await waitingSpan.count()) > 0) {
                throw new BrowserNavigationException(`${lectureIndex}강은 아직 제작중입니다.`);
            }

            const viewButton = lectureItem.locator('a.lecture-view');
            if ((await viewButton.count()) === 0) {
                throw new BrowserNavigationException(
                    `${lectureIndex}강에 강의보기 버튼이 없습니다.`,
                );
            }

            const titleText =
                (await lectureItem.locator('a.lecture-title').textContent()) ?? 'untitled-lecture';

            const courseTitleText =
                (await page
                    .locator(`#lecture-${courseId} .lecture-title.ellipsis a`)
                    .textContent()) ?? 'unknown-course';

            const capturedStreamUrl = await this.clickAndCaptureM3u8(
                context,
                viewButton,
                timeoutMs,
            );

            const streamUrl = new StreamUrl(capturedStreamUrl);
            const lectureTitle = new LectureTitle(titleText.trim());

            this.logger.log(`m3u8 캡처 완료 — ${lectureTitle.value}: ${streamUrl.value}`);
            return { streamUrl, courseTitle: courseTitleText.trim(), lectureTitle };
        } catch (error: unknown) {
            if (error instanceof BrowserNavigationException) throw error;
            const message = error instanceof Error ? error.message : String(error);
            throw new BrowserNavigationException(`브라우저 자동화 실패: ${message}`);
        }
    }

    async dispose(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.logger.log('브라우저 종료 완료');
        }
    }

    private async login(page: Page, timeoutMs: number): Promise<void> {
        const loginUrl = this.configService.get<string>('LECTURE_LOGIN_URL', '');
        const username = this.configService.get<string>('LECTURE_USERNAME', '');
        const password = this.configService.get<string>('LECTURE_PASSWORD', '');

        if (!loginUrl || !username || !password) {
            this.logger.warn('로그인 정보가 설정되지 않았습니다. 로그인을 건너뜁니다.');
            return;
        }

        await page.goto(loginUrl, { waitUntil: 'networkidle', timeout: timeoutMs });
        await page.fill('#username', username);
        await page.fill('#password', password);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle', timeout: timeoutMs }),
            page.evaluate(() => {
                (window as unknown as Record<string, () => void>)['actionLogin']();
            }),
        ]);
        this.logger.log('로그인 완료');
    }

    private async navigateToStudyPage(page: Page, timeoutMs: number): Promise<void> {
        const studyUrl = this.configService.get<string>('LECTURE_STUDY_URL', '');
        if (!studyUrl) {
            throw new BrowserNavigationException(
                'LECTURE_STUDY_URL 환경변수가 설정되지 않았습니다.',
            );
        }
        await page.goto(studyUrl, { waitUntil: 'networkidle', timeout: timeoutMs });
        this.logger.log('학습현황 페이지 이동 완료');
    }

    private async expandCourse(page: Page, courseId: string, timeoutMs: number): Promise<void> {
        const toggleButton = page.locator(`#btn-toggle-${courseId}`).first();
        await toggleButton.click();

        const lectureBody = page.locator(`#lecture-${courseId} .lecture-progress-item-body`);
        await lectureBody.waitFor({ state: 'visible', timeout: timeoutMs });
        this.logger.log(`과목 ${courseId} 펼치기 완료`);
    }

    private async parseLectureList(page: Page, courseId: string): Promise<LectureInfo[]> {
        const lectureItems = page.locator(`#lecture-${courseId} .lecture-list > li`);
        const count = await lectureItems.count();

        const lectures: LectureInfo[] = [];
        for (let i = 0; i < count; i++) {
            const li = lectureItems.nth(i);
            const title = (await li.locator('a.lecture-title').textContent()) ?? '';
            const waitingCount = await li.locator('span.con-waiting').count();
            const viewButtonCount = await li.locator('a.lecture-view').count();
            const available = waitingCount === 0 && viewButtonCount > 0;

            let totalMinutes = 0;
            let studiedMinutes = 0;

            if (available) {
                const time1Text = (await li.locator('.time1').textContent()) ?? '0';
                const time2Text = (await li.locator('.time2').textContent()) ?? '0';
                studiedMinutes = parseInt(time1Text, 10) || 0;
                totalMinutes = parseInt(time2Text, 10) || 0;
            }

            lectures.push({
                lectureIndex: i + 1,
                title: title.trim(),
                available,
                totalMinutes,
                studiedMinutes,
            });
        }

        return lectures;
    }

    private async clickAndCaptureM3u8(
        context: BrowserContext,
        viewButton: ReturnType<Page['locator']>,
        timeoutMs: number,
    ): Promise<string> {
        const capturedUrls: string[] = [];

        const popupPagePromise = new Promise<Page>((resolve) => {
            context.once('page', (newPage: Page) => {
                newPage.on('response', (response) => {
                    const url = response.url();
                    if (url.includes('.m3u8') && !url.endsWith('.ts')) {
                        if (!capturedUrls.includes(url)) {
                            capturedUrls.push(url);
                            this.logger.log(`m3u8 URL 수집: ${url}`);
                        }
                    }
                });
                resolve(newPage);
            });
        });

        await viewButton.click();

        const popup = await popupPagePromise;
        await popup.waitForLoadState('networkidle', { timeout: timeoutMs });

        if (capturedUrls.length === 0) {
            await popup.waitForTimeout(5000);
        }

        // 1차: JW Player API로 직접 추출
        const jwUrl = await this.tryJwPlayerApi(popup);
        if (jwUrl) {
            this.logger.log(`JW Player API에서 m3u8 획득: ${jwUrl}`);
            await popup.close().catch(() => {});
            return jwUrl;
        }

        // 2차: 수집된 m3u8 중 가장 긴 스트림 선택
        if (capturedUrls.length > 1) {
            const longestUrl = await this.findLongestStream(popup, capturedUrls);
            if (longestUrl) {
                this.logger.log(`Duration 비교로 m3u8 선택: ${longestUrl}`);
                await popup.close().catch(() => {});
                return longestUrl;
            }
        }

        await popup.close().catch(() => {});

        // 3차: 폴백 — 마지막 수집된 URL
        if (capturedUrls.length === 0) {
            throw new BrowserNavigationException('m3u8 스트림 URL을 찾을 수 없습니다.');
        }

        const fallbackUrl = capturedUrls[capturedUrls.length - 1];
        this.logger.log(`폴백 m3u8 사용: ${fallbackUrl}`);
        return fallbackUrl;
    }

    private async tryJwPlayerApi(page: Page): Promise<string | null> {
        try {
            const url = await page.evaluate(() => {
                const jw = (window as unknown as Record<string, (...args: unknown[]) => unknown>)[
                    'jwplayer'
                ];
                if (typeof jw !== 'function') return null;
                const player = jw() as Record<string, () => Record<string, unknown>>;
                if (typeof player?.getPlaylistItem !== 'function') return null;
                const item = player.getPlaylistItem();
                return typeof item?.file === 'string' ? item.file : null;
            });
            return url ?? null;
        } catch {
            this.logger.debug('JW Player API 사용 불가 — 폴백으로 전환');
            return null;
        }
    }

    private async findLongestStream(
        page: Page,
        urls: string[],
    ): Promise<string | null> {
        try {
            const result = await page.evaluate(async (m3u8Urls: string[]) => {
                const durations: { url: string; duration: number }[] = [];
                for (const url of m3u8Urls) {
                    try {
                        const res = await fetch(url);
                        const text = await res.text();
                        let total = 0;
                        const matches = text.matchAll(/#EXTINF:([\d.]+)/g);
                        for (const match of matches) {
                            total += parseFloat(match[1]);
                        }
                        durations.push({ url, duration: total });
                    } catch {
                        durations.push({ url, duration: 0 });
                    }
                }
                durations.sort((a, b) => b.duration - a.duration);
                return durations.length > 0 ? durations[0].url : null;
            }, urls);

            return result;
        } catch {
            this.logger.debug('m3u8 duration 비교 실패 — 폴백으로 전환');
            return null;
        }
    }
}
