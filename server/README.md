# AutoFill-Fit Server

채용 지원 자동 완성 서비스의 Nest.js 백엔드 (TypeORM + PostgreSQL + Passport JWT).

## 실행

```bash
cd server
npm install
cp .env.example .env          # DB 접속 정보와 JWT_SECRET 수정
createdb autofill_fit          # PostgreSQL DB 생성
npm run start:dev
```

`DB_SYNCHRONIZE=true`는 개발 편의용입니다. 운영에서는 `false`로 두고 마이그레이션을 사용하세요.

```bash
npm run migration:generate -- src/database/migrations/Init
npm run migration:run
```

## API

| Method | Path | 인증 | 설명 |
| --- | --- | --- | --- |
| POST | `/auth/signup` | - | 회원가입 (bcrypt 해싱, 가입과 동시에 토큰 발급) |
| POST | `/auth/login` | - | 로그인 검증 후 JWT 발급 |
| GET | `/auth/me` | Bearer | 토큰 유효성 확인 |
| GET | `/api/resume/my` | Bearer | 프로필 + 최신 이력서 전체 JSON 반환 |
| PATCH | `/api/resume/my` | Bearer | 프로필 및 이력서 추가/수정 (Upsert) |
| GET | `/admin/stats` | **ADMIN** | 가입·완성도 집계 지표 |
| GET | `/admin/users` | **ADMIN** | 사용자 목록 (검색·필터·정렬, 개인정보 마스킹) |
| GET | `/admin/users/:id` | **ADMIN** | 사용자 상세. `?reveal=true`면 원본 + 감사 로그 기록 |
| PATCH | `/admin/users/:id` | **ADMIN** | 권한 / 활성 상태 변경 |
| DELETE | `/admin/users/:id` | **ADMIN** | 계정 및 이력 데이터 삭제 |
| GET | `/admin/audit-logs` | **ADMIN** | 관리자 행위 기록 |

## 백오피스 (관리자)

### 최초 관리자 만들기

회원가입 API로는 **절대** 관리자가 될 수 없습니다(`SignupDto`에 `role`이 없고
`forbidNonWhitelisted`가 임의 필드를 400으로 거부합니다). 최초 1명은 CLI로 지정합니다.

```bash
npm run admin:grant -- hong@example.com            # 승격
npm run admin:grant -- hong@example.com --revoke   # 회수
```

이후에는 기존 관리자가 백오피스에서 승격/회수할 수 있습니다.

### 권한 모델

- **역할은 토큰이 아니라 매 요청 DB에서 읽습니다.** 토큰에 role을 넣으면 권한을 회수해도
  기존 토큰이 만료될 때까지 통과하기 때문입니다. 강등 즉시 기존 토큰이 403이 됩니다.
- `isActive=false`인 계정은 로그인 단계와 `JwtStrategy` 양쪽에서 차단됩니다.
- 가드레일: 자기 자신의 권한·상태 변경 및 삭제 불가, 마지막 활성 관리자 강등·삭제·비활성화 불가.

### 개인정보 취급

목록과 상세는 **기본이 마스킹**입니다(`홍*동`, `010-****-5678`, `1995-**-**`,
`서울시 강남구 ***`). 자기소개서 본문은 부분 마스킹해도 문맥이 남아 사실상 열람이 되므로
**아예 내려보내지 않고 글자수만** 표시합니다.

원본이 필요하면 `?reveal=true&reason=<사유>`로 요청합니다. **사유는 필수**이며
(`SUPPORT` 문의 대응 / `ABUSE_REPORT` 신고 조사 / `USER_REQUEST` 본인 요청),
없으면 400으로 거부됩니다. `admin_audit_logs`에 행위자·대상·시각·IP·**사유**가 기록됩니다.
사유 없는 열람을 허용하면 로그가 "누가 봤다"까지만 남고 "왜 봤는지"가 비어 사후 검토가 불가능해집니다.

### 완성도 배점과 신입

기본 인적사항 30 / 학력·경력 40(학력 20 + 경력 20) / 자격증 10 / 자소서 20 = 100점.

신입은 경력 20점에 구조적으로 닿지 못해 완성도가 영구 미완으로 남습니다.
사용자가 `resume.extra.noCareer = true`(UI의 "경력이 없습니다") 를 선언하면
경력 배점을 만점에서 빼고 나머지를 100으로 환산합니다. 선언하지 않으면 그냥 미작성으로 봅니다 —
임의로 추측하지 않습니다. 이 규칙은 `server/src/admin/utils/completeness.util.ts`,
`web/lib/completeness.ts`, `mobile/src/lib/completeness.ts` 세 곳에 같이 있습니다.

### PATCH Upsert 규칙

- 프로필/이력서 레코드가 **없으면 생성**, 있으면 수정한다.
- 스칼라 필드(`title`, `headline`, `profile.*`)는 **본문에 포함된 것만** 반영한다.
- JSONB 배열(`education`, `careers`, `certificates`, `essays`)은 **지정한 배열만 통째로 교체**한다.
  지정하지 않은 배열은 그대로 유지된다.
- `extra`는 기존 객체와 얕게 병합한다.
- 프로필과 이력서는 **한 트랜잭션**으로 저장되며, 검증 실패 시 아무것도 반영되지 않는다.

### GET /api/resume/my 응답

```jsonc
{
  "user": { "id": "...", "email": "hong@example.com" },
  "profile": {
    "name": "홍길동", "phone": "01012345678", "birthdate": "1995-03-02",
    "address": "서울시 강남구 테헤란로 123", "zipCode": "06236"
  },
  "resume": {
    "title": "백엔드 개발자 이력서",
    "headline": "시니어 백엔드 개발자",
    "education":    [{ "schoolName": "한국대학교", "major": "컴퓨터공학", "degree": "BACHELOR",
                       "gpa": "3.85", "gpaScale": "4.50",
                       "admissionDate": "2014-03", "graduationDate": "2018-02" }],
    "careers":      [{ "companyName": "로지소프트", "department": "플랫폼팀", "jobTitle": "백엔드 개발",
                       "joinDate": "2020-01", "leaveDate": null, "isCurrent": true,
                       "mainTasks": "결제 API 설계 및 개발" }],
    "certificates": [{ "name": "정보처리기사", "issuer": "한국산업인력공단", "acquiredAt": "2019-08-16" }],
    "essays":       [{ "title": "지원 동기를 작성해 주세요.", "type": "MOTIVATION",
                       "content": "...", "charLimit": 1000, "keywords": ["지원동기"] }],
    "skills": ["TypeScript", "Nest.js"],
    "extra": { "militaryService": "만기전역" }
  },
  // content.js의 profile 객체와 키가 1:1로 대응된다.
  "autofill": {
    "name": "홍길동", "email": "hong@example.com", "phone": "01012345678",
    "birthdate": "1995-03-02", "address": "서울시 강남구 테헤란로 123",
    "zipCode": "06236", "coverLetter": "귀사의 기술 문화에 공감하여 지원했습니다.",
    // 문항별 매칭용 — 뭉치지 않은 원본 배열
    "essays": [
      { "title": "지원 동기를 작성해 주세요.", "type": "MOTIVATION",
        "keywords": ["지원동기"], "charLimit": 1000, "isDefault": true, "content": "..." }
    ]
  },
  "updatedAt": "2026-09-07T13:12:41.894Z"
}
```

### `autofill.essays`가 따로 있는 이유

지원서에 자소서 문항이 2개 이상인 것은 기본값입니다. 하나로 뭉쳐 내려주면 확장이
모든 장문 칸에 같은 글을 넣게 되므로, **문항 배열을 그대로** 내려줍니다.

- 제목과 본문이 모두 채워진 문항만 포함합니다. 빈 문항을 내려보내면 확장이 지원서에
  빈 칸을 채우게 됩니다.
- 확장이 매칭에 쓰는 `keywords`·`charLimit`·`type`을 함께 내려줍니다.
- 같은 이유로 `education`·`careers`·`certificates`도 평탄화해 내려줍니다.
  전부 최신순이고, 재직 중인 경력의 `leaveDate`는 `null`로 비웁니다.
- 이력서가 없으면 `null`이 아니라 `[]`입니다. `null`이면 확장이 순회에서 터집니다.

`autofill.coverLetter`는 `isDefault` → `type: "MOTIVATION"` → 첫 문항 순으로 선택되며,
**아직 `essays`를 읽지 못하는 구버전 확장을 위한 fallback**으로만 남아 있습니다.

## Chrome Extension 연동

**확장은 이 API를 직접 호출하지 않습니다.** 그러려면 확장에 별도 로그인과 토큰 보관이
필요합니다. 대신 웹 대시보드가 `autofill`을 받아 `postMessage`로 확장에 넘기고,
확장은 그것을 `chrome.storage.local`에 보관합니다. 토큰은 넘기지 않습니다.

브리지 프로토콜과 신뢰 origin 목록은 [루트 README](../README.md#확장--대시보드-브리지)에
있습니다. 따라서 이 서버에는 `chrome-extension://` CORS 항목도, 확장의
`host_permissions`도 필요하지 않습니다.

## 내 계정

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `GET` | `/api/users/me/export` | 계정·인적사항·이력서 전체를 한 응답으로 |
| `DELETE` | `/api/users/me` | 회원 탈퇴 (본문에 `password` 필요) |

탈퇴는 되돌릴 수 없으므로 비밀번호를 다시 받습니다. 토큰만으로 지우게 하면 잠깐
자리를 비운 사이 열린 브라우저에서 삭제가 일어납니다.

## 운영

- `GET /health` — 프로세스와 **DB 연결**을 함께 확인합니다. 인증이 없고 요청 제한에서도 빠집니다.
- 모든 응답에 `X-Request-Id`. 앞단이 붙인 값은 형식이 맞을 때만 이어 씁니다.
- 전역 예외 필터가 5xx에만 스택을 남기고, 예상 못 한 예외의 내용은 응답에 넣지 않습니다.

관리자 통계(`GET /admin/stats`)는 개수를 SQL로 세고 완성도만 `STATS_BATCH_SIZE`
(기본 500)씩 끊어 읽습니다. 예전에는 `users`·`profiles`·`resumes`를 통째로 메모리에
올려서, 자소서 전문이 든 JSONB 때문에 사용자가 늘면 첫 화면이 서버를 넘어뜨렸습니다.

## 마이그레이션

```bash
npm run migration:generate -- src/database/migrations/<이름>
npm run migration:run
```

`src/database/migrations/`의 `InitialSchema`가 기준점입니다. `DB_SYNCHRONIZE`는
기본이 `false`이고, `NODE_ENV=production`에서는 그 값과 무관하게 꺼집니다.

`synchronize`는 컬럼명을 바꿀 때 `DROP` + `ADD`로 처리하므로, JSONB에 이력 전체가
들어 있는 이 스키마에서는 커밋 하나가 전 사용자의 이력서를 지울 수 있습니다.

## 요청 제한

`POST /auth/login`은 분당 10회, `POST /auth/signup`은 시간당 5회(IP 기준)입니다.
여기에 더해 **계정 단위로** 연속 실패를 세어 5회에서 10분간 잠급니다
(`users.failed_login_attempts`, `users.locked_until`).

통합 테스트에서만 `THROTTLE_DISABLED=true`로 끕니다. `.env.example`에 넣지 않았습니다.

## 데이터 모델

```
User (1) ─── (1) Profile     name, phone, birthdate, address, zipCode
  │                          + 동의 시각(terms/privacy)과 policyVersion
  │                          + 로그인 실패 횟수와 잠금 시각
  │
  └── (N) Resume             isPrimary + updatedAt 기준으로 최신 1건 조회
        ├── education      JSONB[]  학교명, 전공, 학점, 입학/졸업년월
        ├── careers        JSONB[]  회사명, 부서, 직무, 입사/퇴사년월, 주요업무
        ├── certificates   JSONB[]  자격증명, 발급기관, 취득일
        └── essays         JSONB[]  문항 제목/유형, 답변 내용, 매칭 키워드, 글자수 제한
```

JSONB 항목의 타입은 [`src/resume/types/resume-json.types.ts`](src/resume/types/resume-json.types.ts)에 정의되어 있습니다.

> **JSONB는 DB가 형태를 강제하지 않습니다.** 따라서 쓰기 경로에서
> [`src/resume/dto/resume-json.dto.ts`](src/resume/dto/resume-json.dto.ts)의 `@ValidateNested({ each: true })`로
> 배열 각 항목까지 검증합니다. 이 검증을 우회하면 어떤 형태의 값이든 저장되어
> 확장 프로그램 쪽에서 런타임 오류가 발생하므로, 항목을 추가할 때 타입과 DTO를 함께 갱신해야 합니다.

## 보안 메모

- 비밀번호는 bcrypt(cost 12)로 해싱하며, `User.password`는 `select: false`라 기본 조회에 포함되지 않습니다.
- 로그인 실패 시 계정 존재 여부가 응답 시간으로 새지 않도록 더미 해시와 비교합니다.
- `JwtStrategy`는 서명 검증 후 DB에서 사용자 존재 여부까지 확인합니다(탈퇴 계정 토큰 차단).
- `JWT_SECRET`은 반드시 충분히 긴 랜덤 문자열로 교체하고, 저장소에 커밋하지 마세요.
- 전역 `ValidationPipe`가 `whitelist` + `forbidNonWhitelisted`로 동작해 정의되지 않은 필드는 400으로 거부됩니다.
