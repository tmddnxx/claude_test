# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 1. 프로젝트 개요

NestJS 기반 모놀리식 백엔드 프로젝트. 도메인별 엄격한 모듈 분리를 적용하며, 계층형 아키텍처(Layered Architecture)와 도메인 주도 설계(DDD) 원칙을 따른다.
모든 명령어는 `nest-project/` 디렉토리에서 실행한다.

## 2. 기술 스택

| 항목 | 버전/도구 |
|------|-----------|
| Runtime | Node.js 20.20.0 |
| Framework | NestJS 11.0.16 |
| Language | TypeScript (strict) |
| Database | PostgreSQL |
| ORM | TypeORM |
| Validation | class-validator, class-transformer |
| API 문서 | Swagger (개발 환경 전용) |
| 테스트 | Jest, supertest |

## 3. 아키텍처

**모놀리식 + 도메인별 모듈 분리 + 계층형 아키텍처**

요청 흐름:

```
Controller → Application(Service) → Domain → Infrastructure
```

- **Controller**: HTTP 요청/응답 처리만 담당. 비즈니스 로직 금지.
- **Application (Service)**: 도메인 로직을 조합(orchestrate)하고 트랜잭션을 관리한다.
- **Domain**: 비즈니스 규칙과 핵심 로직이 존재하는 유일한 계층. 엔티티, 값 객체, 도메인 서비스 포함.
- **Infrastructure**: 데이터베이스 접근, 외부 시스템 연동. TypeORM 리포지토리는 이 계층에서만 사용한다.

## 4. 계층별 책임

| 계층 | 책임 | 금지 사항 |
|------|------|-----------|
| Controller | 요청 파싱, DTO 유효성 검증, 응답 반환 | 비즈니스 로직, DB 직접 접근 |
| Application | 유스케이스 실행, 트랜잭션 관리, 도메인 서비스 호출 | DB 직접 접근, HTTP 관련 코드 |
| Domain | 비즈니스 규칙, 엔티티 행위, 도메인 이벤트 | 프레임워크 의존, DB 직접 접근 |
| Infrastructure | TypeORM 리포지토리 구현, 외부 API 호출 | 비즈니스 로직 |

## 5. DDD 구조 규칙

- 각 도메인은 독립 NestJS 모듈로 구성한다.
- 도메인 간 의존은 인터페이스(포트)를 통해서만 허용한다.
- Aggregate Root를 통해서만 하위 엔티티에 접근한다.
- 도메인 계층은 NestJS, TypeORM 등 프레임워크에 의존하지 않는다.
- 리포지토리는 도메인 계층에서 인터페이스를 정의하고, Infrastructure 계층에서 구현한다.

## 6. 폴더 구조 컨벤션

```
src/
├── main.ts
├── app.module.ts
├── common/                          # 공유 유틸, 데코레이터, 인터셉터, 필터
│   ├── decorators/
│   ├── filters/
│   ├── interceptors/
│   ├── guards/
│   └── types/
├── config/                          # 환경변수 설정
└── modules/
    └── {domain}/                    # 도메인별 모듈
        ├── {domain}.module.ts
        ├── controller/
        │   └── {domain}.controller.ts
        ├── application/
        │   └── {domain}.service.ts
        ├── domain/
        │   ├── entities/
        │   ├── value-objects/
        │   ├── interfaces/          # 리포지토리 인터페이스(포트)
        │   └── services/            # 도메인 서비스
        ├── infrastructure/
        │   └── repositories/        # TypeORM 리포지토리 구현체
        └── dto/
            ├── request/
            └── response/
```

## 7. 코딩 컨벤션

- **Prettier**: 작은따옴표, trailing comma `all`
- **ESLint**: flat config (`eslint.config.mjs`), typescript-eslint 타입 체크 규칙 적용
- `any` 타입 사용 금지 — 반드시 명시적 타입 또는 제네릭을 사용한다.
- 모든 비동기 처리는 `async/await`만 사용한다 (콜백, `.then()` 체인 금지).
- 한 파일에 하나의 클래스만 정의한다.

## 8. DTO 규칙

- 요청 DTO와 응답 DTO를 분리한다 (`dto/request/`, `dto/response/`).
- 요청 DTO는 `class-validator` 데코레이터로 유효성을 검증한다.
- 응답 DTO는 `class-transformer`의 `Exclude`/`Expose`로 직렬화를 제어한다.
- 엔티티를 직접 응답으로 반환하지 않는다 — 반드시 응답 DTO로 변환한다.

```typescript
// 요청 DTO 예시
export class CreateUserRequestDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;
}
```

## 9. 엔티티 규칙

모든 엔티티는 다음 베이스 컬럼을 포함하는 추상 클래스를 상속한다:

```typescript
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
```

- 삭제는 소프트 딜리트(`@DeleteDateColumn`)를 기본으로 한다.
- 엔티티 내부에 비즈니스 메서드를 정의하여 Anemic Domain Model을 피한다.
- 컬럼명은 `snake_case`, 프로퍼티명은 `camelCase`를 사용한다.

## 10. 리포지토리 규칙

- 도메인 계층에 인터페이스를 정의한다:

```typescript
// domain/interfaces/user.repository.interface.ts
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<User>;
}
```

- Infrastructure 계층에서 TypeORM으로 구현하고, NestJS DI 토큰으로 주입한다.
- 리포지토리 구현체 외부에서 `QueryBuilder`를 직접 사용하지 않는다.

## 11. 트랜잭션 규칙

- 여러 Aggregate를 수정하는 작업은 반드시 트랜잭션으로 감싼다.
- 트랜잭션은 Application(Service) 계층에서 관리한다.
- `DataSource.transaction()` 또는 `QueryRunner`를 사용한다.

```typescript
async transferPoints(fromId: string, toId: string, amount: number): Promise<void> {
  await this.dataSource.transaction(async (manager) => {
    // 트랜잭션 내에서 여러 aggregate 조작
  });
}
```

## 12. API 응답 표준

모든 API는 통일된 응답 포맷을 사용한다:

```typescript
// 성공
{
  "success": true,
  "data": { ... },
  "meta": { "timestamp": "2024-01-01T00:00:00.000Z" }
}

// 실패
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "사용자를 찾을 수 없습니다."
  },
  "meta": { "timestamp": "2024-01-01T00:00:00.000Z" }
}
```

- 페이지네이션이 필요한 목록 API는 `meta`에 `page`, `limit`, `totalCount`를 포함한다.
- HTTP 상태 코드를 정확히 사용한다 (200, 201, 400, 401, 403, 404, 409, 500).

## 13. 에러 처리 규칙

- 도메인 에러는 커스텀 예외 클래스로 정의한다 (`DomainException` 상속).
- 전역 `ExceptionFilter`에서 도메인 예외를 HTTP 응답으로 변환한다.
- 예외에는 고유한 에러 코드(`string`)를 부여한다 (예: `USER_NOT_FOUND`, `INVALID_ORDER_STATE`).
- 예상하지 못한 에러는 500으로 응답하되, 내부 상세 정보를 클라이언트에 노출하지 않는다.

## 14. 로깅 규칙

- NestJS 내장 `Logger`를 사용한다.
- 각 클래스에서 `private readonly logger = new Logger(ClassName.name)`으로 인스턴스를 생성한다.
- 로그 레벨: `error` (장애), `warn` (경고), `log` (주요 흐름), `debug` (개발용 상세).
- 민감 정보(비밀번호, 토큰 등)는 로그에 기록하지 않는다.

## 15. 환경변수 구조

`@nestjs/config`의 `ConfigModule`을 사용하며, `.env` 파일로 관리한다:

```
# 서버
PORT=3000
NODE_ENV=development

# 데이터베이스
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=
DB_DATABASE=app_dev

# JWT (필요 시)
JWT_SECRET=
JWT_EXPIRES_IN=3600
```

- 환경변수는 `ConfigService`를 통해서만 접근한다 (`process.env` 직접 참조 금지, `main.ts` 제외).

## 16. 데이터베이스 규칙

- 테이블명은 `snake_case` 복수형으로 한다 (예: `users`, `order_items`).
- 외래 키 컬럼명은 `{관계}_id` 형식으로 한다 (예: `user_id`).
- 인덱스는 자주 조회하는 컬럼과 외래 키에 명시적으로 추가한다.
- `synchronize: true`는 프로덕션에서 절대 사용하지 않는다.

## 17. 마이그레이션 정책

- 스키마 변경은 반드시 TypeORM 마이그레이션 파일로 관리한다.
- 마이그레이션 파일명은 타임스탬프 기반으로 자동 생성한다.

```bash
# 마이그레이션 생성
npx typeorm migration:generate src/migrations/{MigrationName} -d src/config/data-source.ts

# 마이그레이션 실행
npx typeorm migration:run -d src/config/data-source.ts

# 마이그레이션 롤백
npx typeorm migration:revert -d src/config/data-source.ts
```

- 마이그레이션은 롤백 가능하도록 `up()`과 `down()`을 모두 구현한다.
- 데이터 손실이 발생하는 마이그레이션(컬럼 삭제 등)은 단계적으로 진행한다.

## 18. 네이밍 컨벤션

| 대상 | 규칙                                      | 예시 |
|------|-----------------------------------------|------|
| 클래스 | PascalCase                              | `UserService`, `CreateOrderRequestDto` |
| 파일 | kebab-case                              | `user.service.ts`, `create-order.request.dto.ts` |
| 변수/함수 | camelCase                               | `findById`, `orderCount` |
| DB 테이블 | snake_case 단수형                          | `user`, `order_item` |
| DB 컬럼 | snake_case                              | `created_at`, `user_id` |
| 환경변수 | UPPER_SNAKE_CASE                        | `DB_HOST`, `JWT_SECRET` |
| 인터페이스 | `I` 접두사 + PascalCase                    | `IUserRepository` |
| DTO | `{Action}{Domain}{Request/Response}Dto` | `CreateUserRequestDto` |

## 19. 테스트 전략

```bash
npm test                                        # 전체 단위 테스트
npm test -- --testPathPattern=user.service       # 단일 파일 테스트
npm run test:e2e                                 # E2E 테스트
npm run test:cov                                 # 커버리지 리포트
```

- **단위 테스트** (`*.spec.ts`): 소스 파일과 같은 디렉토리에 배치. 도메인 로직과 서비스 중심으로 작성.
- **E2E 테스트** (`test/*.e2e-spec.ts`): supertest로 API 엔드포인트 검증.
- 외부 의존성(DB, 외부 API)은 모킹한다.
- 테스트에서 실제 DB 연결이 필요한 경우 별도 테스트 DB를 사용한다.

## 20. 금지 사항

- Controller에 비즈니스 로직 작성
- Domain 계층에서 프레임워크(NestJS, TypeORM) 직접 의존
- `any` 타입 사용
- `synchronize: true` 프로덕션 사용
- 엔티티 직접 응답 반환 (DTO 변환 필수)
- `process.env` 직접 참조 (`main.ts` 제외)
- 콜백 또는 `.then()` 체인 사용 (`async/await`만 허용)
- Infrastructure 계층 외부에서 TypeORM 리포지토리 직접 사용
- Swagger를 프로덕션에서 활성화
- 마이그레이션 없이 스키마 변경