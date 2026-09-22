/**
 * 확장 설정.
 *
 * content.js는 빌드 과정이 없는 단일 파일이라 환경변수를 주입할 수 없다.
 * 배포할 때 고쳐야 하는 값만 여기 모아 두고, manifest가 content.js보다
 * 먼저 읽도록 해 둔다. content script끼리는 같은 isolated world를 공유하므로
 * 여기서 선언한 값을 content.js가 그대로 읽는다.
 *
 * 이 파일을 고치지 않으면 대시보드를 어디에 올리든 브리지가 응답하지 않아
 * '이력서 전달' 자체가 되지 않는다.
 */

/**
 * 대시보드를 신뢰하는 origin 목록.
 *
 * 여기 없는 페이지에는 확장이 존재 여부도, 자동 채움 이력도 알려주지 않는다.
 * 아무 사이트나 그 정보를 읽어가지 못하게 막는 것이 목적이므로,
 * 와일드카드를 쓰지 말고 실제 도메인을 하나씩 적는다.
 *
 * 예) 'https://autofill-fit.example.com'
 */
// eslint-disable-next-line no-unused-vars
var AUTOFILL_FIT_TRUSTED_ORIGINS = [
  // --- 로컬 개발 ---
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3021',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',

  // --- 운영 도메인을 여기에 추가한다 ---
  // 'https://your-dashboard.example.com',
];
