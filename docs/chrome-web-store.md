# Chrome 웹 스토어 배포 가이드

AutoFill-Fit 확장을 Chrome 웹 스토어에 올리기까지 해야 할 일을 순서대로 정리했습니다.
요구사항은 2026년 10월 기준 [Chrome for Developers 공식 문서](#참고)로 확인했고,
현재 상태는 이 저장소의 코드를 직접 점검한 결과입니다.

> **요약** — 확장 코드는 스토어 정책상 깨끗합니다. 하지만 지금 올리면 아무도 쓸 수 없습니다.
> 대시보드가 `localhost`에만 있어서, 다른 사람이 확장을 설치해도 이력서를 받아 올 곳이 없기 때문입니다.
> **대시보드·API 공개 배포가 먼저**이고, 스토어 제출은 마지막 단계입니다.

---

## 1. 현재 상태

| 항목 | 상태 | 비고 |
| --- | --- | --- |
| Manifest V3 | ✅ | |
| 원격 코드·`eval` 없음 | ✅ | MV3는 원격 호스팅 코드를 금지합니다 |
| 외부로 데이터 전송 없음 | ✅ | `fetch`·XHR·WebSocket 호출이 없습니다. 이력서는 `chrome.storage.local`에만 남습니다 |
| 대시보드·API 공개 배포 | ❌ | 전부 `localhost` |
| `config.js`에 운영 도메인 | ❌ | 로컬 주소만 있습니다 |
| 아이콘 | ❌ | `manifest.json`에 `icons` 항목 자체가 없습니다 |
| 홍보 타일·스크린샷 | ❌ | |
| 개인정보 처리방침 공개 URL | ❌ | `/privacy` 페이지는 있지만 공개 주소가 아닙니다 |
| `activeTab` 권한 | ⚠️ | **선언만 하고 쓰지 않습니다** — [3절](#3-권한-정리--심사에서-가장-중요) |
| 모든 사이트 주입 | ⚠️ | 심사를 길게 만드는 대표 요인입니다 — [3절](#3-권한-정리--심사에서-가장-중요) |
| 처리방침에 자동 채움 기록 명시 | ⚠️ | [8절](#8-개인정보-탭--그대로-붙여넣기) |

---

## 2. 대시보드·API 공개 배포 (선행 조건)

확장은 서버를 직접 부르지 않고, **대시보드 페이지에서 `postMessage`로 이력서를 받습니다.**
그래서 대시보드가 공개 HTTPS 주소에 있어야 하고, 그 주소가 확장의 신뢰 목록에 있어야 합니다.

### 무엇을 어디에 올리나

| 구성 요소 | 폴더 | 필요한 것 |
| --- | --- | --- |
| API | `server/` | Node 22 이상, 상시 실행되는 컨테이너 또는 VM |
| DB | — | PostgreSQL (관리형 권장 — 백업이 따라옵니다) |
| 대시보드 | `web/` | Next.js 호스팅 |

API와 대시보드는 **각각 HTTPS 도메인**이 있어야 합니다. 예: `api.example.com`, `app.example.com`.

### 운영 환경변수 — `server/.env`

| 변수 | 값 | 주의 |
| --- | --- | --- |
| `NODE_ENV` | `production` | `synchronize`가 강제로 꺼집니다 |
| `DB_HOST` · `DB_PORT` · `DB_USERNAME` · `DB_PASSWORD` · `DB_DATABASE` | 운영 DB | |
| `JWT_SECRET` | **새로 만든 긴 난수** | 로컬 값을 쓰지 마세요 |
| `CORS_ORIGINS` | `https://app.example.com` | **대시보드 주소만** — 확장은 API를 부르지 않으므로 `chrome-extension://`는 필요 없습니다 |
| `WEB_ORIGIN` | `https://app.example.com` | 비밀번호 재설정 메일의 링크 출처. 비우면 요청 헤더를 따라가 위험합니다 |
| `SMTP_URL` · `MAIL_FROM` | 메일 서비스 | 비우면 재설정 메일이 나가지 않습니다 |
| `TRUST_PROXY` | 로드밸런서 뒤라면 `true` | 아니면 모든 요청이 같은 IP로 보여 한 사람이 전체를 잠급니다 |
| `THROTTLE_DISABLED` | **설정하지 않음** | 켜면 로그인·가입 제한이 통째로 꺼집니다 |

배포할 때마다:

```bash
cd server
npm ci && npm run build
npm run migration:run      # 스키마는 마이그레이션으로만 바꿉니다
npm run start:prod
```

### 대시보드 — `web/`

```
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

### 확장 — `config.js`

운영 대시보드 주소를 신뢰 목록에 넣습니다. **이걸 빼먹으면 '이력서 전달'이 동작하지 않습니다.**

```js
var AUTOFILL_FIT_TRUSTED_ORIGINS = [
  'https://app.example.com',
];
```

스토어 버전에는 `localhost` 항목을 빼는 것을 권합니다. 남겨 두면 사용자 PC에서 같은 포트로
뜬 아무 페이지나 확장 존재 여부와 자동 채움 기록을 물어볼 수 있습니다.

---

## 3. 권한 정리 — 심사에서 가장 중요

### 지금 선언된 권한

```json
"permissions": ["activeTab", "storage"],
"content_scripts": [{ "matches": ["http://*/*", "https://*/*"], ... }]
```

- **`storage`** — 사용합니다. 이력서를 `chrome.storage.local`에 둡니다.
- **`activeTab`** — **쓰지 않습니다.** 백그라운드 스크립트도 툴바 액션도 없어서 쓸 곳이 없습니다.
  스토어는 필요한 최소 권한만 요구하므로 **반려 사유가 됩니다.**
- **모든 사이트 주입** — 공식 문서가 심사를 길게 만드는 요인으로 `*://*/*` 같은 넓은 호스트 권한을
  직접 지목합니다. 새 개발자·새 확장도 추가 검토 대상이고, 이 확장은 개인정보까지 다룹니다.

### 선택지

**A. 지금 구조 유지** — `activeTab`을 지우고, 넓은 호스트 권한의 사유를 씁니다.

- 장점: 코드 변경 최소
- 단점: 심사가 길어질 수 있음. 네이버·유튜브 같은 **모든 사이트에 보라색 버튼이 뜨는** 문제가 그대로

**B. 툴바 버튼 방식으로 전환 (권장)**

- 사용자가 확장 아이콘을 누른 탭에만 `activeTab` + `chrome.scripting`으로 실행합니다
- 넓은 호스트 권한이 필요 없습니다
- 대시보드 연결용 스크립트만 **대시보드 도메인에 한정**해 남깁니다
- 장점: 심사가 빠르고, 사용자 신뢰가 높고, 모든 사이트에 버튼이 뜨던 문제도 사라집니다
- 단점: 자동입력 버튼이 페이지 안이 아니라 툴바로 옮겨갑니다

B로 바꾸면 manifest는 대략 이렇게 됩니다.

```json
{
  "manifest_version": 3,
  "permissions": ["activeTab", "scripting", "storage"],
  "action": { "default_title": "AutoFill-Fit으로 채우기" },
  "background": { "service_worker": "background.js" },
  "content_scripts": [{
    "matches": ["https://app.example.com/*"],
    "js": ["config.js", "bridge.js"]
  }]
}
```

---

## 4. 이미지 준비

| 이미지 | 크기 | 필수 | 메모 |
| --- | --- | --- | --- |
| 확장 아이콘 | 128×128 PNG | ✅ | 실제 그림은 96×96, 사방 16px 투명 여백. 밝은·어두운 배경 모두에서 보여야 합니다 |
| 작은 홍보 타일 | 440×280 | ✅ | |
| 스크린샷 | 1280×800 또는 640×400 | ✅ 1장 이상 (최대 5장) | 모서리 둥글리지 않기, 여백 없이 꽉 채우기. 1280×800 권장 |
| 마키 홍보 타일 | 1400×560 | — | 메인 노출을 노릴 때만 |

manifest에도 아이콘을 넣습니다.

```json
"icons": { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" }
```

**스크린샷 추천 구성**

1. 지원서 위에 뜬 **확인 패널** — 무엇이 어디로 들어가는지 보여주는 화면
2. 채워진 지원서 + "N개 입력 완료" 안내
3. 대시보드의 이력서 편집 화면
4. 대시보드의 **확장 연결 카드**("이력서 전달")

홍보 이미지와 스크린샷에는 글자를 많이 넣지 마세요. 축소돼 보일 때 읽히지 않습니다.

---

## 5. 패키징

저장소 루트에 `server/` `web/` `mobile/` `docs/`가 함께 있습니다. **zip에는 확장 파일만** 넣고,
`manifest.json`은 zip의 최상위에 있어야 합니다.

```powershell
# PowerShell — 저장소 루트에서
New-Item -ItemType Directory -Force dist | Out-Null
Compress-Archive -Force `
  -Path manifest.json, config.js, content.js, styles.css, icons `
  -DestinationPath dist\autofill-fit-1.0.0.zip
```

`dist/`와 `*.zip`은 `.gitignore`가 막고 있어 커밋되지 않습니다.

**업데이트할 때마다 `manifest.json`의 `version`을 올려야** 스토어가 새 버전으로 받습니다.

---

## 6. 개발자 등록

- **1회 5달러**, 환불되지 않습니다. 결제는 본인이 직접 해야 합니다.
- **개발자 이메일은 나중에 바꿀 수 없습니다.** 삭제한 계정의 이메일도 재사용할 수 없습니다.
  자주 확인하는 전용 주소를 쓰세요 — 심사 결과와 정책 위반 통지가 이 주소로 옵니다.

---

## 7. 스토어 등록 정보 — 초안

### 이름

```
AutoFill-Fit
```

### 짧은 설명 (`manifest.json`의 `description`, 132자 이내)

```
저장해 둔 이력서로 채용 지원서를 채워 줍니다. 넣기 전에 무엇이 어디로 가는지 보여 주고, 되돌릴 수 있습니다.
```

### 자세한 설명

```
한 번 저장한 이력서로 채용 사이트 지원서를 채워 줍니다.

■ 넣기 전에 확인합니다
버튼을 누르면 바로 채우지 않고, 어느 칸에 무엇이 들어갈지 목록으로 먼저 보여 줍니다.
항목별로 끌 수 있고, 자기소개서는 기본으로 꺼져 있습니다.

■ 틀린 칸에 넣지 않습니다
확신이 없는 칸은 비워 두고 알려 줍니다. 잘못 채워진 지원서는 빈 지원서보다 나쁘기 때문입니다.
글자수 제한을 넘는 답변은 잘라 넣지 않고 비워 둡니다.

■ 되돌릴 수 있습니다
채운 직후 '되돌리기'를 누르면 채우기 전으로 돌아갑니다.

■ 문항별 자기소개서
지원 동기·성장 과정·입사 후 포부처럼 문항이 여러 개여도, 문항마다 맞는 답변을 찾아 넣습니다.

■ 채우는 항목
이름·이메일·연락처·생년월일·주소, 학력(학교·전공·학점·졸업), 경력(회사·부서·직무·직급),
자격증, 자기소개서

■ 개인정보
이력서는 이 브라우저 안에만 저장되며 확장이 외부로 보내지 않습니다.
대시보드에서 로그아웃하면 확장에 남은 정보도 함께 지워집니다.

이용하려면 AutoFill-Fit 대시보드(https://app.example.com)에서 이력서를 작성한 뒤
'이력서 전달'을 눌러 주세요.
```

### 카테고리 · 언어

- 카테고리: 생산성 계열 중 가장 가까운 것
- 언어: 한국어

---

## 8. 개인정보 탭 — 그대로 붙여넣기

심사자가 읽는 항목이라 **영문을 함께** 적었습니다. 둘 중 하나만 써도 됩니다.

### 단일 목적 (Single purpose)

```
지원자가 저장한 이력서로 채용 지원서의 입력칸을 채웁니다.

Fills job application forms with the résumé the user has saved in the AutoFill-Fit dashboard.
```

### 권한별 사유

**`storage`**

```
대시보드에서 전달받은 이력서를 이 브라우저에 보관하기 위해 필요합니다. 다른 곳으로 보내지 않습니다.

Stores the résumé the user sends from the AutoFill-Fit dashboard, locally in this browser. It is never transmitted elsewhere.
```

**A안을 택한 경우 — 호스트 권한 (`http://*/*`, `https://*/*`)**

```
지원서는 기업마다 다른 도메인에 있어 미리 목록을 정할 수 없습니다. 페이지에서 지원서 입력칸을 찾기 위해
필요하며, 실제 입력은 사용자가 버튼을 누르고 확인 목록에서 승인한 뒤에만 이뤄집니다. 페이지 내용을 수집하거나
외부로 보내지 않습니다.

Job applications are hosted on each employer's own domain, so they cannot be enumerated in advance. The script
locates application fields on the page; it only fills them after the user clicks the button and approves the
list of fields to be filled. Page content is never collected or transmitted.
```

**B안을 택한 경우 — `activeTab` · `scripting`**

```
사용자가 툴바의 AutoFill-Fit 아이콘을 누른 탭에서만 지원서 입력칸을 찾고 채우기 위해 필요합니다.

Used only on the tab where the user clicks the AutoFill-Fit toolbar icon, to locate and fill the application form.
```

**B안 — 대시보드 도메인 한정 콘텐츠 스크립트**

```
사용자가 대시보드에서 '이력서 전달'을 눌렀을 때 이력서를 받기 위해, 대시보드 도메인에서만 실행됩니다.

Runs only on the AutoFill-Fit dashboard domain, to receive the résumé when the user clicks "Send résumé".
```

### 원격 코드

```
아니요, 원격 코드를 사용하지 않습니다.
No, I am not using remote code.
```

### 데이터 사용 공개

이 확장이 다루는 데이터를 점검한 결과입니다.

| 항목 | 체크 | 근거 |
| --- | --- | --- |
| **Personally identifiable information** | ✅ | 이름·이메일·연락처·생년월일·주소 |
| **Web history** | ✅ | 자동 채움을 한 **사이트 주소(host)와 시각**을 로컬에 기록합니다(`fillHistory`). "다음부터 묻지 않기"로 허용한 사이트 주소도 남깁니다(`allowedHosts`) |
| 그 밖의 항목 | — | 학력·경력·자기소개서는 위 개인정보에 포함해 설명합니다 |

세 가지 확인 항목에도 체크합니다.

- 승인된 용도 외에 제3자에게 판매·전송하지 않습니다
- 확장의 단일 목적과 무관한 용도로 쓰지 않습니다
- 신용도 판단이나 대출 목적으로 쓰지 않습니다

### 개인정보 처리방침 URL

```
https://app.example.com/privacy
```

> **제출 전에 처리방침을 보강하세요.** 지금 `/privacy`는 확장이 이력서를 로컬에 둔다는 점은 적혀 있지만,
> **자동 채움을 한 사이트 주소와 시각을 기록한다**는 점이 빠져 있습니다. 데이터 공개에 'Web history'를
> 체크하면서 처리방침에 없으면 서로 맞지 않습니다.

---

## 9. 심사

- 보통 **며칠**, 길면 **몇 주**입니다. 3주가 넘도록 변화가 없으면 개발자 지원팀에 문의합니다.
- 더 꼼꼼히 보는 경우: **새 개발자**, **새 확장**, **넓은 호스트 권한**, 큰 코드 변경.
  이 확장은 앞의 셋에 모두 해당할 수 있습니다(A안 기준).
- 코드 난독화는 금지, **압축(minify)은 허용**됩니다. `content.js`는 빌드 없이 원본 그대로라 문제없습니다.

### 반려를 피하려면

- 쓰지 않는 권한을 남기지 않습니다 — **지금 `activeTab`이 그렇습니다**
- 스토어 설명·처리방침·데이터 공개가 실제 동작과 일치해야 합니다
- 스크린샷이 실제 화면이어야 합니다

---

## 10. 제출 전 체크리스트

**배포**

- [ ] API·DB·대시보드를 HTTPS 도메인에 배포
- [ ] 운영 환경변수 설정 — 특히 `JWT_SECRET`(새 값), `WEB_ORIGIN`, `CORS_ORIGINS`, `SMTP_URL`
- [ ] `npm run migration:run`
- [ ] `/privacy`에 자동 채움 기록(사이트 주소·시각) 내용 추가

**확장**

- [ ] 권한 방식 결정 (A 유지 / B 툴바 전환)
- [ ] A라면 `activeTab` 삭제
- [ ] `config.js`에 운영 대시보드 주소 추가, `localhost` 제거
- [ ] 아이콘 16·48·128 추가, manifest `icons` 항목 추가
- [ ] `manifest.json`의 `description`을 짧은 설명으로 교체
- [ ] 운영 대시보드로 실제 지원서에서 끝까지 동작 확인
- [ ] zip 만들기 — 최상위에 `manifest.json`

**스토어**

- [ ] 개발자 등록 (5달러, 전용 이메일)
- [ ] 홍보 타일 440×280, 스크린샷 1280×800 1~5장
- [ ] 등록 정보 — 이름·설명·카테고리·언어
- [ ] 개인정보 탭 — 단일 목적, 권한별 사유, 원격 코드, 데이터 공개, 처리방침 URL
- [ ] 제출

---

## 11. 배포 후

- 업데이트할 때마다 `manifest.json`의 `version`을 올리고 zip을 다시 만들어 업로드합니다.
- 대시보드 도메인을 바꾸면 `config.js`도 바꿔 **확장을 다시 배포**해야 합니다.
  사용자 확장이 새 버전으로 업데이트되기 전까지는 연결이 끊깁니다.
- 권한을 늘리는 업데이트는 사용자에게 다시 동의를 받으므로, 일부 사용자는 확장이 꺼진 상태로 남습니다.
  처음부터 필요한 만큼만 받는 게 낫습니다.

---

## 참고

- [Register your developer account — Chrome for Developers](https://developer.chrome.com/docs/webstore/register)
- [Supplying images — Chrome for Developers](https://developer.chrome.com/docs/webstore/images)
- [Fill out the privacy fields — Chrome for Developers](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [Chrome Web Store review process — Chrome for Developers](https://developer.chrome.com/docs/webstore/review-process)
- [Chrome Web Store Developer Fee 2026 — extensionradar](https://www.extensionradar.com/blog/chrome-web-store-developer-fee-2026)
- [Chrome Web Store requiring up-front registration fee — 9to5Google](https://9to5google.com/2020/03/12/chrome-web-store-fee/)
