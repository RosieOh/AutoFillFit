# AutoFill-Fit Mobile

이력서를 이동 중에 다듬는 React Native 앱. Expo SDK 57 + expo-router + NativeWind.
백엔드는 [`../server`](../server)의 Nest.js API를 그대로 씁니다.

## 실행

```bash
cd mobile
npm install
cp .env.example .env       # API 주소 확인
npx expo start             # QR을 Expo Go로 스캔하거나 a/i 키로 에뮬레이터 실행
```

### API 주소

기기에서 보는 `localhost`는 PC가 아닙니다.

| 실행 환경 | 주소 |
| --- | --- |
| Android 에뮬레이터 | `http://10.0.2.2:3000` (코드가 자동 변환) |
| iOS 시뮬레이터 | `http://localhost:3000` |
| 실기기 (Expo Go) | PC의 LAN IP — `EXPO_PUBLIC_API_BASE_URL`에 직접 지정 |

`EXPO_PUBLIC_` 변수는 번들 시점에 인라인되므로 바꾼 뒤 dev 서버를 다시 시작해야 합니다.
백엔드 쪽에는 `CORS_ORIGINS`가 필요 없습니다(네이티브 요청에는 Origin이 없습니다).
Expo Web으로 볼 때만 `http://localhost:8081`을 추가하세요.

## 화면

```
src/app/
  _layout.tsx              Stack + Auth/Resume/Toast Provider
  index.tsx                토큰 확인 후 분기
  login.tsx                로그인 · 회원가입
  (tabs)/
    _layout.tsx            하단 탭 (내 이력서 / 백오피스 / 설정)
    index.tsx              완성도 + 섹션 목록
    admin.tsx              백오피스 개요
    settings.tsx           계정 · 서버 주소 · 로그아웃
  resume/[section].tsx     섹션 편집 (인적사항 / 학력·경력 / 자격증 / 자소서)
  admin/
    users/index.tsx        사용자 목록 (무한 스크롤)
    users/[id].tsx         사용자 상세 · 마스킹 해제 · 계정 관리
    audit.tsx              감사 로그
```

**웹과 다른 정보 구조** — 웹은 좌측 사이드바에 4개 섹션 탭을 두지만, 모바일은
홈에서 섹션 목록을 보여주고 탭하면 편집 화면을 push합니다. 긴 폼을 좁은 화면에서
탭으로 전환하면 현재 위치를 잃기 쉽고, 편집 화면마다 고정 저장 버튼을 둘 수 있습니다.

## 웹과 다른 구현

| | web | mobile |
| --- | --- | --- |
| 토큰 저장 | `localStorage` | `expo-secure-store` (OS 키체인) |
| 401 처리 | `window.location.replace` | `setUnauthorizedHandler` 콜백 → `router.replace` |
| 선택 입력 | `<select>` | 칩 버튼 (탭 한 번으로 선택) |
| 삭제 확인 | 문구 입력 모달 | 네이티브 `Alert` (destructive 스타일) |
| 목록 페이지네이션 | 이전/다음 버튼 | `FlatList` 무한 스크롤 |
| 저장 버튼 | 상단 sticky 헤더 | 하단 고정 (엄지가 닿는 곳) |

## 알려진 함정

**NativeWind는 `Animated.View`의 `className`을 처리하지 않습니다.** core `View`가 아니라
`createAnimatedComponent`로 감싼 컴포넌트이기 때문입니다. 애니메이션이 필요한 요소는
바깥을 `style`만 쓰는 `Animated.View`로 감싸고 안쪽 `View`가 `className`을 담당하게 하세요.
이걸 놓치면 스타일이 통째로 무시돼 요소가 보이지 않습니다
([`ui.tsx`의 ProgressBar](src/components/ui.tsx), [`toast.tsx`](src/components/toast.tsx) 참고).

**토스트에는 `zIndex`가 필요합니다.** 주지 않으면 react-navigation의 하단 탭바가 덮습니다.

**요청 인터셉터는 토큰 하이드레이션을 기다려야 합니다.** SecureStore 읽기가 비동기라
기다리지 않으면 앱 첫 로드·딥링크에서 토큰 없이 요청이 나가 401 → 인터셉터가 토큰 삭제 →
**로그인 상태인 사용자가 로그아웃당합니다.** `api.ts`의 `ensureHydrated()`가 이걸 막습니다.

**`(tabs)` 밖 화면에도 auth 게이트가 필요합니다.** 딥링크·새로고침으로 바로 진입할 수 있어
`AuthGate`로 감쌉니다. 토큰 복원 중(`state === 'loading'`)에는 판단을 미뤄야 합니다.

## 타입 동기화

`src/types/`는 `web/types/`의 복사본입니다. 서버 DTO가 바뀌면
**server / web / mobile 세 곳**을 함께 고쳐야 합니다.
완성도 배점(기본 인적사항 30 / 학력·경력 40 / 자격증 10 / 자소서 20)도 마찬가지입니다.

## 자소서 매칭 키워드

자소서 문항의 "매칭 키워드"는 여기서도 편집할 수 있지만, **실제로 쓰이는 곳은
데스크톱 Chrome 확장**입니다. 앱에서 채워 두면 PC에서 대시보드를 열어 확장에
전달했을 때 문항별 매칭에 반영됩니다. 규칙은
[루트 README](../README.md#문항별-자소서-매칭)에 있습니다.

## 빌드

```bash
npx expo export --platform android   # 번들 검증 (에뮬레이터 불필요)
npx expo run:android                 # 네이티브 빌드 (Android Studio 필요)
```

iOS 빌드는 macOS가 필요합니다. Windows에서는 Expo Go 또는 EAS Build를 쓰세요.
