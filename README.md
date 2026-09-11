# AutoFill-Fit

채용 지원서를 자동으로 채워 주는 서비스. 이력서를 한 번 저장해 두면 Chrome 확장이
채용 사이트 지원서의 입력칸을 채웁니다.

```
.
├── content.js · manifest.json · styles.css   Chrome 확장 (MV3)
├── server/                                    Nest.js + TypeORM + PostgreSQL
├── web/                                       Next.js 14 대시보드 + 백오피스
└── mobile/                                    Expo(React Native) 앱
```

각 폴더의 README에 실행 방법과 설계 메모가 있습니다.

[`docs/feature-gaps.html`](docs/feature-gaps.html) — 없어서 실제로 문제가 되는 기능 37건을
5개 관점·3개 렌즈로 판정한 우선순위 목록. 브라우저로 열면 항목마다 판정 근거가 펼쳐집니다.

## 데이터가 흐르는 경로

```
[web 대시보드]  ── 저장 ──▶  [server]  ── GET /api/resume/my ──▶  [web 대시보드]
       │
       └─ postMessage(SYNC) ─▶  [확장 content script]  ──▶  chrome.storage.local
                                            │
                                            ▼
                                   [채용 사이트 지원서 자동 채움]
                                            │
                                            └─ 이력 기록 ─▶ 대시보드에 표시
```

**확장은 서버를 직접 호출하지 않습니다.** 그러려면 확장에 별도 로그인과 토큰 보관이
필요한데, 대신 **대시보드가 확장에 이력서를 넘기는** 방향으로 잡았습니다.
토큰은 넘기지 않고 자동입력에 쓸 값만 전달합니다.

대가는 하나입니다 — 저장했다고 확장이 바로 아는 게 아니라, PC에서 대시보드를 열어
전달해야 합니다. 이 사실을 숨기지 않고 대시보드가 "아직 전달하지 않았습니다"로 알립니다.

## 확장 ↔ 대시보드 브리지

`externally_connectable`은 확장 ID를 알아야 하는데 개발 중 unpacked 확장은 ID가 매번
바뀝니다. 그래서 **content script ↔ 페이지 postMessage 핸드셰이크**를 씁니다.

| 방향 | 메시지 | 내용 |
| --- | --- | --- |
| 페이지 → 확장 | `PING` | 설치 여부 확인 (응답 없으면 미설치) |
| 확장 → 페이지 | `PONG` | 버전 · 마지막 전달 시각 · 자동 채움 이력 5건 |
| 페이지 → 확장 | `SYNC` | 자동입력용 이력서 + **자소서 문항 전체** (토큰 없음) |
| 확장 → 페이지 | `SYNCED` | 전달 완료 시각 |

**신뢰 origin에서만 응답합니다** (`content.js`의 `TRUSTED_ORIGINS`). 아무 사이트나
확장 설치 여부와 자동 채움 이력을 읽어가지 못하게 막는 것이 목적이며,
운영 도메인을 배포할 때 이 목록에 추가해야 합니다.

content script는 `document_idle`에, 대시보드는 hydration 후에 준비되어 순서가 보장되지
않으므로 `PING`은 2.5초 동안 재시도합니다.

## 문항별 자소서 매칭

지원서에 자소서 문항이 2개 이상인 것은 예외가 아니라 기본값입니다. 그래서 서버는
자소서를 **문항 배열 그대로** 내려주고(`autofill.essays`), 확장이 칸마다 어느 문항을
넣을지 정합니다. 하나로 뭉쳐 넘기면 모든 장문 칸에 같은 글이 들어갑니다.

칸의 라벨·placeholder·name을 합친 문자열에 대해 문항마다 점수를 매깁니다.

| 신호 | 점수 |
| --- | --- |
| 문항 제목이 통째로 들어 있음 | 100 |
| 문항 유형의 관용 표현 (`지원동기`, `성장과정`, `입사후포부` …) | 50 |
| 사용자가 지정한 매칭 키워드 1개 | 45 |
| 제목 토큰 겹침 비율 | 최대 45 |

점수 40 이상인 (칸, 문항) 쌍을 점수 순으로 훑으며 **칸도 문항도 한 번씩만** 배정합니다.
키워드 1개만 맞아도 임계값을 넘도록 45점을 줍니다 — 그보다 낮으면 대시보드의
"매칭 키워드" 입력칸이 혼자서는 아무 일도 하지 않습니다.

**확신이 없으면 비워 둡니다.** `OVERWRITE_EXISTING=false`라 잘못 채워진 자소서는 손으로
지워야 복구되고, 잘못 채워진 자소서는 빈 자소서보다 나쁩니다. 예외는 장문 칸이 딱
하나일 때뿐이고, 그때만 기본 자소서를 씁니다.

저장된 `charLimit`과 그 칸의 `maxlength` 중 **작은 쪽**을 넘으면 넣지 않습니다.
넣으면 문장 중간에서 잘린 채 제출됩니다.

비워 둔 칸은 두 가지로 알립니다. 채운 개수만 보고하는 것은 절반의 보고입니다.

- 토스트에 이유를 한 줄씩 (`「입사 후 포부」 269자 → 200자 제한을 넘어 비워 뒀습니다`)
- 해당 입력칸에 남는 표시 — 토스트가 사라진 뒤에도 어느 칸에 손대야 하는지 남아야
  합니다. 사용자가 그 칸을 누르면 표시를 거둡니다.

## 테스트

```bash
cd server && npm test        # Jest 단위 — 완성도 규칙, 마스킹
cd server && npm run test:e2e # 실제 Postgres에 붙는 API 통합 테스트
cd web && npm test           # Vitest — web↔mobile 규칙 일치, 폼 변환, 확장 매칭
```

통합 테스트는 **testcontainers로 Postgres를 띄웁니다**(Docker 필요). 개발자의 로컬 DB
자격증명에 기대지 않아야 어디서든 같은 조건으로 돌기 때문입니다.
이미 쓸 수 있는 DB가 있으면 그쪽을 쓰게 할 수 있습니다.

```bash
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/autofill_fit_test npm run test:e2e
```

**158개 테스트가 실제로 있었던 결함을 고정합니다.** 각 테스트는 해당 버그를 코드에
다시 넣었을 때 실패하는 것을 확인했습니다 — 통과만 하는 테스트는 안전망이 아닙니다.

| 테스트 | 고정하는 결함 |
| --- | --- |
| `server/.../completeness.util.spec.ts` | 서버가 `careerExcluded`를 `scoreHistory`에 넘기지 않아 관리자·사용자 화면이 25%p 어긋남 |
| `server/.../mask.util.spec.ts` | 마스킹이 조용히 약해지는 회귀 |
| `web/test/completeness-parity.test.ts` | web과 mobile의 완성도 규칙이 갈라짐 |
| `web/test/resume-form.test.ts` | 빈 문자열을 보내 저장 전체가 400으로 실패 |
| `web/test/extension/content-script.test.ts` | 더미 프로필이 실제 지원서에 채워짐 · 자소서가 무관한 textarea에 주입됨 · **모든 장문 칸에 같은 답변이 복사됨** · 제한 초과 답변이 잘린 채 들어감 |
| `server/test/auth.e2e-spec.ts` | 가입 본문으로 role 주입 · 비활성 계정이 기존 토큰으로 통과 |
| `server/test/resume.e2e-spec.ts` | 빈 문자열·JSONB 내부 형식 오류가 저장을 통과 · `autofill.essays`가 문항을 뭉개서 내려줌 |
| `server/test/admin.e2e-spec.ts` | 사유 없는 개인정보 열람 · 권한 회수 후 기존 토큰 통과 · 삭제 시 고아 데이터 |

확장은 빌드 과정이 없는 단일 IIFE라 jsdom에서 그대로 실행해 검증합니다
(`offsetParent` shim이 필요합니다 — jsdom은 레이아웃을 계산하지 않습니다).

## 세 곳에 같이 있는 것

독립 폴더 구조라 아래는 복사본입니다. 하나를 바꾸면 나머지도 함께 고쳐야 합니다.

| 대상 | 위치 |
| --- | --- |
| 이력서 타입 | `web/types/`, `mobile/src/types/` |
| 완성도 배점 | `server/src/admin/utils/completeness.util.ts`, `web/lib/completeness.ts`, `mobile/src/lib/completeness.ts` |
| 열람 사유 enum | `server/src/admin/dto/admin.dto.ts`, `web/app/admin/users/[id]/page.tsx`, `mobile/src/app/admin/users/[id].tsx` |
