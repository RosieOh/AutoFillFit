/**
 * AutoFill-Fit — content script
 * 채용 사이트 지원서의 input/textarea를 탐지해 사용자 정보를 자동 입력한다.
 */
(() => {
  'use strict';

  // 중복 주입 방지 (SPA 라우팅 / 재주입 대비)
  if (window.__autoFillFitInjected) return;
  window.__autoFillFitInjected = true;

  /* ------------------------------------------------------------------ *
   * 1. 사용자 데이터 (chrome.storage.sync에 저장된 값이 있으면 덮어씀)
   * ------------------------------------------------------------------ */
  /**
   * 빈 값이어야 한다.
   * 그럴듯한 더미 값('홍길동' 등)을 두면 대시보드에서 이력서를 전달하기 전에
   * 버튼을 누른 사용자가 실제 지원서에 가짜 데이터를 제출하게 된다.
   */
  const DEFAULT_PROFILE = {
    name: '',
    email: '',
    phone: '',
    birthdate: '',
    address: '',
    zipCode: '',
    coverLetter: ''
  };

  let profile = { ...DEFAULT_PROFILE };

  /** 대시보드에서 이력서를 받은 적이 있는가. 없으면 자동 입력을 막는다. */
  let hasSyncedProfile = false;

  /**
   * 자소서 문항 전체.
   * 이게 없으면 모든 장문 칸에 fallback 하나가 똑같이 들어간다.
   */
  let essays = [];

  /**
   * 학력·경력·자격증. 전부 최신순이라 [0]이 최종학력·현재 직장이다.
   * 대시보드가 70점을 배정하는 내용인데, 여기에 없으면 지원서에 한 글자도 못 넣는다.
   */
  let education = [];
  let careers = [];
  let certificates = [];

  // 이미 값이 채워진 필드를 덮어쓸지 여부
  const OVERWRITE_EXISTING = false;

  /** 대시보드에서 동기화된 값 (chrome.storage.local) */
  let syncedAt = null;

  /**
   * 이력서를 마지막으로 저장한 시각 (서버 기준).
   *
   * syncedAt과 다르다. 두 달 전에 쓴 이력서를 어제 전달했다면
   * syncedAt은 어제지만 내용은 두 달 전 것이다. 채우기 전에 이 값을 보여준다.
   */
  let resumeUpdatedAt = null;

  function loadProfile() {
    try {
      if (!chrome || !chrome.storage) return;

      // 대시보드가 넘겨준 값이 있으면 그것을 쓰고, 없으면 sync/기본값으로 내려간다.
      chrome.storage.local.get(
        [
          'syncedProfile', 'syncedAt', 'syncedEssays',
          'syncedEducation', 'syncedCareers', 'syncedCertificates',
          'resumeUpdatedAt'
        ],
        (local) => {
        if (chrome.runtime.lastError) return;

        const list = (value) => (Array.isArray(value) ? value : []);

        essays = list(local && local.syncedEssays);
        education = list(local && local.syncedEducation);
        careers = list(local && local.syncedCareers);
        certificates = list(local && local.syncedCertificates);
        resumeUpdatedAt = (local && local.resumeUpdatedAt) || null;

        if (local && local.syncedProfile) {
          profile = { ...DEFAULT_PROFILE, ...local.syncedProfile };
          syncedAt = local.syncedAt || null;
          hasSyncedProfile = true;
          return;
        }

        chrome.storage.sync.get(DEFAULT_PROFILE, (stored) => {
          if (chrome.runtime.lastError) return;
          profile = { ...DEFAULT_PROFILE, ...stored };
          hasSyncedProfile = Object.keys(profile).some(
            (key) => profile[key] && String(profile[key]).trim() !== ''
          );
        });
        },
      );
    } catch (_) {
      /* storage 사용 불가 환경에서는 기본값 유지 */
    }
  }

  /**
   * 대시보드에서 전달하면 이미 열려 있던 탭의 profile도 즉시 갱신돼야 한다.
   * 구독하지 않으면 그 탭들은 새로고침 전까지 옛 이력서로 채운다.
   */
  function watchProfileChanges() {
    try {
      if (!chrome || !chrome.storage || !chrome.storage.onChanged) return;

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;

        if (changes.syncedProfile) {
          const next = changes.syncedProfile.newValue;
          if (next) {
            profile = { ...DEFAULT_PROFILE, ...next };
            hasSyncedProfile = true;
          } else {
            // 대시보드에서 로그아웃하면 지워진다.
            profile = { ...DEFAULT_PROFILE };
            hasSyncedProfile = false;
            essays = [];
            education = [];
            careers = [];
            certificates = [];
          }
        }

        const listOf = (change) =>
          Array.isArray(change.newValue) ? change.newValue : [];

        if (changes.syncedEssays) essays = listOf(changes.syncedEssays);
        if (changes.syncedEducation) education = listOf(changes.syncedEducation);
        if (changes.syncedCareers) careers = listOf(changes.syncedCareers);
        if (changes.syncedCertificates) certificates = listOf(changes.syncedCertificates);

        if (changes.syncedAt) syncedAt = changes.syncedAt.newValue || null;
        if (changes.resumeUpdatedAt) {
          resumeUpdatedAt = changes.resumeUpdatedAt.newValue || null;
        }
      });
    } catch (_) {
      /* 구독 실패해도 다음 페이지 로드에서 최신값을 읽는다. */
    }
  }

  /* ------------------------------------------------------------------ *
   * 2. 매칭 규칙 — 위에서부터 순서대로 평가 (우선순위 있음)
   * ------------------------------------------------------------------ */
  const RULES = [
    {
      key: 'email',
      test: /(e-?mail|mail|이메일|메일)/i,
      exclude: /(mailing[-_ ]?address|우편)/i,
      value: () => profile.email
    },
    {
      key: 'phone',
      test: /(phone|tel(?![a-z])|mobile|cell|contact[-_ ]?number|전화|휴대|핸드폰|연락처)/i,
      exclude: /(telegram|television)/i,
      value: () => profile.phone
    },
    {
      key: 'name',
      test: /(^|[^a-z])(name|username|user[-_ ]?name|fullname|full[-_ ]?name|applicant|성명|이름|지원자)/i,
      // 이름이 아닌 'name' 계열 오탐 차단
      exclude: /(company|corp|school|univ|file|card|nickname|domain|account|bank|project|team|product|major|degree|certificate|회사|학교|파일|은행|전공|자격)/i,
      value: () => profile.name
    },

    /* --- 인적사항 나머지 --- */
    {
      key: 'zipCode',
      // 주소보다 먼저 본다. '우편번호'에는 '주소'가 없지만 'address'는 겹칠 수 있다.
      test: /(zip|postal|post[-_ ]?code|우편\s?번호|우편)/i,
      value: () => profile.zipCode
    },
    {
      key: 'address',
      test: /(address|addr|주소|거주지|소재지)/i,
      exclude: /(e-?mail|이메일|메일|ip[-_ ]?address|zip|postal|우편)/i,
      value: () => profile.address
    },
    {
      key: 'birthdate',
      test: /(birth|생년월일|생일|출생)/i,
      exclude: /(year|month|day|년|월|일자)$/i,
      value: () => profile.birthdate
    },

    /* --- 학력 (최종학력이 첫 항목) --- */
    {
      key: 'schoolName',
      test: /(school|univ|college|대학교|대학원|학교명|출신\s?학교|학교)/i,
      exclude: /(중학교|초등학교|major|전공|학과)/i,
      value: () => firstOf(education, 'schoolName')
    },
    {
      key: 'major',
      test: /(major|전공|학과(?!장))/i,
      value: () => firstOf(education, 'major')
    },
    {
      key: 'gpa',
      test: /(gpa|학점|평점)/i,
      exclude: /(만점|기준|scale)/i,
      value: () => firstOf(education, 'gpa')
    },
    {
      key: 'gpaScale',
      test: /(gpa[-_ ]?scale|학점\s?만점|만점\s?기준|만점)/i,
      value: () => firstOf(education, 'gpaScale')
    },
    {
      key: 'graduationDate',
      test: /(graduat|졸업\s?(년월|일자|년도|연도|일)|졸업)/i,
      exclude: /(구분|상태|여부|status)/i,
      value: () => firstOf(education, 'graduationDate')
    },
    {
      key: 'admissionDate',
      test: /(admission|enroll|입학\s?(년월|일자|년도|연도)?|입학)/i,
      value: () => firstOf(education, 'admissionDate')
    },

    /* --- 경력 (재직 중인 곳이 첫 항목) --- */
    {
      key: 'companyName',
      test: /(company|employer|근무처|직장|회사명|회사)/i,
      exclude: /(school|univ|학교)/i,
      value: () => firstOf(careers, 'companyName')
    },
    {
      key: 'department',
      test: /(department|부서|소속)/i,
      exclude: /(학과|전공)/i,
      value: () => firstOf(careers, 'department')
    },
    {
      key: 'jobTitle',
      test: /(job[-_ ]?title|job[-_ ]?role|직무|직종|담당\s?업무)/i,
      exclude: /(주요\s?업무|상세)/i,
      value: () => firstOf(careers, 'jobTitle')
    },
    {
      key: 'position',
      test: /(position|직급|직위)/i,
      value: () => firstOf(careers, 'position')
    },
    {
      key: 'joinDate',
      test: /(join|hire|입사\s?(년월|일자)?|입사)/i,
      value: () => firstOf(careers, 'joinDate')
    },
    {
      key: 'leaveDate',
      test: /(leave[-_ ]?date|resign|퇴사\s?(년월|일자)?|퇴사)/i,
      value: () => firstOf(careers, 'leaveDate')
    },

    /* --- 자격증 (취득일 최신순) --- */
    {
      key: 'certificateName',
      test: /(certificat|license|자격증(?!\s?번호)|자격\s?사항)/i,
      exclude: /(발급|기관|issuer|취득|번호)/i,
      value: () => firstOf(certificates, 'name')
    },
    {
      key: 'certificateIssuer',
      test: /(issuer|발급\s?기관|시행\s?기관|발행처)/i,
      value: () => firstOf(certificates, 'issuer')
    },
    {
      key: 'certificateAcquiredAt',
      test: /(취득\s?(일자|일)?|acquired)/i,
      value: () => firstOf(certificates, 'acquiredAt')
    }
  ];

  /** 목록의 첫 항목에서 값을 꺼낸다. 비어 있으면 빈 문자열 — 채우지 않는다는 뜻이다. */
  function firstOf(list, key) {
    const item = Array.isArray(list) && list.length > 0 ? list[0] : null;
    const value = item ? item[key] : null;
    return value == null ? '' : String(value);
  }

  // 자소서 / 경력 등 장문 입력 판별
  const LONG_TEXT_HINT = /(cover[-_ ]?letter|self[-_ ]?introduction|motivation|personal[-_ ]?statement|자기소개|자소서|지원\s?동기|입사\s?후\s?포부)/i;

  // 자동입력에서 제외할 input type
  const SKIP_TYPES = new Set([
    'hidden', 'submit', 'button', 'reset', 'image', 'file',
    'checkbox', 'radio', 'range', 'color', 'password'
  ]);

  /* ------------------------------------------------------------------ *
   * 3. 필드 컨텍스트 수집 (id / name / placeholder / label / aria-*)
   * ------------------------------------------------------------------ */
  function getLabelText(el) {
    const parts = [];

    // 3-1. label[for="id"]
    if (el.id) {
      const escaped = (window.CSS && CSS.escape) ? CSS.escape(el.id) : el.id.replace(/"/g, '\\"');
      document.querySelectorAll('label[for="' + escaped + '"]')
        .forEach((l) => parts.push(l.textContent));
    }

    // 3-2. 감싸고 있는 <label>
    const wrapping = el.closest('label');
    if (wrapping) parts.push(wrapping.textContent);

    // 3-3. aria-labelledby가 가리키는 요소
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      labelledBy.split(/\s+/).forEach((id) => {
        const ref = document.getElementById(id);
        if (ref) parts.push(ref.textContent);
      });
    }

    // 3-4. label을 못 찾으면 부모 컨테이너를 보되, 그 안에 입력이 하나뿐일 때만.
    //      입력이 여러 개면 이웃 필드의 라벨까지 흡수해 이름 칸에 이메일이 들어간다.
    if (parts.join('').trim() === '') {
      const box = el.closest('div, li, td, th, p, fieldset');
      if (box && box.querySelectorAll('input, textarea, select').length === 1) {
        const text = box.textContent || '';
        if (text.length <= 60) parts.push(text);
      }
    }

    return parts.join(' ');
  }

  /** 매칭에 사용할 힌트 문자열(haystack)을 만든다. */
  function buildHaystack(el) {
    return [
      el.id,
      el.name,
      el.getAttribute('placeholder'),
      el.getAttribute('aria-label'),
      el.getAttribute('autocomplete'),
      el.getAttribute('title'),
      el.getAttribute('data-testid'),
      typeof el.className === 'string' ? el.className : '',
      getLabelText(el)
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ------------------------------------------------------------------ *
   * 4. 채울 값 결정
   * ------------------------------------------------------------------ */
  function resolveValue(el) {
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    const haystack = buildHaystack(el);

    // 4-1. input type 자체가 강한 힌트
    if (tag === 'input') {
      if (type === 'email') return { key: 'email', value: profile.email };
      if (type === 'tel') return { key: 'phone', value: profile.phone };
    }

    // 4-2. 키워드 규칙
    for (const rule of RULES) {
      if (rule.exclude && rule.exclude.test(haystack)) continue;
      if (rule.test.test(haystack)) return { key: rule.key, value: rule.value() };
    }

    // 4-3. 자소서는 힌트가 있을 때만 넣는다.
    //      textarea라는 이유만으로 넣으면 배송 요청사항·문의 내용 같은
    //      전혀 다른 칸에 자소서 전문이 들어간다.
    if (LONG_TEXT_HINT.test(haystack)) {
      return { key: 'coverLetter', value: profile.coverLetter };
    }

    return null;
  }


  /* ------------------------------------------------------------------ *
   * 4.2 선택형 필드 — select / radio
   *
   * 한국 지원서의 학력구분·졸업상태·성별·병역은 대부분 select와 radio다.
   * 저장값은 코드(BACHELOR)인데 화면에는 한국어(학사, 대학교(4년))로 적혀 있어
   * 문자열 비교로는 절대 맞지 않는다. 코드마다 실제로 쓰이는 표현을 적어 둔다.
   * ------------------------------------------------------------------ */

  const CHOICE_TERMS = {
    degree: {
      HIGH_SCHOOL: ['고등학교', '고졸', '고교', 'high school'],
      ASSOCIATE: ['전문학사', '전문대', '초대졸', '2년제', '3년제', 'associate'],
      BACHELOR: ['학사', '대학교', '대졸', '4년제', 'bachelor', 'university'],
      MASTER: ['석사', '대학원', 'master'],
      DOCTOR: ['박사', 'doctor', 'phd']
    },
    status: {
      GRADUATED: ['졸업'],
      ENROLLED: ['재학'],
      LEAVE: ['휴학'],
      DROPPED: ['중퇴', '자퇴', '중도포기'],
      EXPECTED: ['졸업예정', '졸업 예정', '예정']
    }
  };

  /**
   * 보기 하나와 저장값의 적합도.
   *
   * '졸업'과 '졸업예정'은 서로를 포함한다. 포함만 보면 GRADUATED가
   * '졸업예정' 보기를 골라 버리므로, 정확히 같은 경우를 가장 높게 둔다.
   */
  function scoreChoice(optionText, terms) {
    const target = normalize(optionText);
    if (!target) return 0;

    let best = 0;
    for (const term of terms) {
      const t = normalize(term);
      if (!t) continue;
      if (target === t) best = Math.max(best, 100);
      else if (target.indexOf(t) === 0) best = Math.max(best, 60);
      else if (target.indexOf(t) !== -1) best = Math.max(best, 30);
    }
    return best;
  }

  /** 저장값(코드 또는 자유 문자열)에 대응하는 표현 목록 */
  function termsFor(kind, value) {
    const dict = CHOICE_TERMS[kind];
    const mapped = dict && dict[value];
    // 사전에 없으면 값 자체를 표현으로 쓴다 (자유 입력 항목).
    return mapped && mapped.length ? mapped.concat([value]) : [String(value)];
  }

  /** select에서 고를 option을 찾는다. 확신이 없으면 null. */
  function pickOption(select, kind, value) {
    if (!value) return null;

    const terms = termsFor(kind, value);
    let best = null;
    let bestScore = 0;

    for (const option of Array.from(select.options)) {
      // '선택하세요' 같은 빈 보기는 건너뛴다.
      if (!option.value && !option.textContent.trim()) continue;
      const score = Math.max(
        scoreChoice(option.textContent, terms),
        scoreChoice(option.value, terms)
      );
      if (score > bestScore) {
        bestScore = score;
        best = option;
      }
    }

    return bestScore >= 60 ? best : null;
  }

  /** 라디오 그룹에서 고를 항목을 찾는다. 확신이 없으면 null. */
  function pickRadio(group, kind, value) {
    if (!value) return null;

    const terms = termsFor(kind, value);
    let best = null;
    let bestScore = 0;

    for (const input of group) {
      const score = Math.max(
        scoreChoice(getLabelText(input), terms),
        scoreChoice(input.value, terms)
      );
      if (score > bestScore) {
        bestScore = score;
        best = input;
      }
    }

    return bestScore >= 60 ? best : null;
  }

  /**
   * 선택형 칸에 넣을 값을 정한다.
   * kind는 CHOICE_TERMS의 사전 이름이고, 사전에 없는 항목은 값 그대로 비교한다.
   */
  function resolveChoice(haystack) {
    if (/(최종\s?학력|학력\s?구분|학위|degree)/i.test(haystack)) {
      return { key: 'degree', kind: 'degree', value: firstOf(education, 'degree') };
    }
    if (/(졸업\s?(구분|상태|여부)|재학\s?여부|status)/i.test(haystack)) {
      return { key: 'status', kind: 'status', value: firstOf(education, 'status') };
    }

    // 사전이 없는 선택형은 일반 규칙을 그대로 쓴다 (학교명·전공 select 등).
    for (const rule of RULES) {
      if (rule.exclude && rule.exclude.test(haystack)) continue;
      if (rule.test.test(haystack)) {
        return { key: rule.key, kind: null, value: rule.value() };
      }
    }
    return null;
  }

  /** select / radio에 값을 넣고, 실제로 반영됐는지 돌려준다. */
  function fillChoice(el, option) {
    if (el.tagName.toLowerCase() === 'select') {
      el.focus();
      el.value = option.value;
      if (el.value !== option.value) el.selectedIndex = option.index;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.blur();
      return el.value === option.value || el.selectedIndex === option.index;
    }

    option.focus();
    option.checked = true;
    option.dispatchEvent(new Event('click', { bubbles: true }));
    option.dispatchEvent(new Event('input', { bubbles: true }));
    option.dispatchEvent(new Event('change', { bubbles: true }));
    option.blur();
    return option.checked;
  }

  /* ------------------------------------------------------------------ *
   * 4.5 자소서 문항 매칭
   *
   * 이전에는 장문 칸이 여러 개면 전부 같은 답변이 들어갔다.
   * 지원서에 문항이 2개 이상인 것은 예외가 아니라 기본값이고,
   * OVERWRITE_EXISTING=false라 잘못 채워지면 손으로 지워야 복구된다.
   * 잘못 채워진 자소서는 빈 자소서보다 나쁘므로, 확신이 없으면 비워 둔다.
   * ------------------------------------------------------------------ */

  /** 문항 유형 → 지원서에서 실제로 쓰이는 표현 */
  const ESSAY_TYPE_TERMS = {
    MOTIVATION: ['지원동기', '지원이유', '지원하게된계기', 'motivation'],
    GROWTH: ['성장과정', '성장배경', '살아온과정'],
    STRENGTH_WEAKNESS: ['장단점', '장점과단점', '강점과약점', '성격의장단점'],
    EXPERIENCE: ['경험', '역량', '직무역량', '핵심역량', '프로젝트경험'],
    ASPIRATION: ['입사후포부', '포부', '입사후계획', '향후계획'],
    ETC: []
  };

  /** 비교 전 정규화 — 띄어쓰기·구두점 변형을 흡수한다. */
  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[\s ]+/g, '')
      .replace(/[.,·・/()[\]{}<>"'’“”:;!?~\-_*]/g, '');
  }

  /** 제목에서 의미 있는 조각을 뽑는다(조사·안내문구 제거는 하지 않고 길이로 거른다). */
  function titleTokens(title) {
    return String(title || '')
      .split(/[\s.,·・/()[\]{}<>"'’“”:;!?~\-_*]+/)
      .map((token) => normalize(token))
      .filter((token) => token.length >= 2);
  }

  const MATCH_THRESHOLD = 40;

  /** 키워드 1개 적중만으로 임계값을 넘도록 — 아래로 내리면 키워드 입력이 무력해진다. */
  const KEYWORD_WEIGHT = 45;

  /**
   * 필드와 문항의 적합도.
   * 제목 전체 일치 > 유형 표현 > 키워드 > 토큰 겹침 순으로 무겁게 본다.
   */
  function scoreEssay(haystack, essay) {
    const target = normalize(haystack);
    if (!target) return 0;

    let score = 0;

    const title = normalize(essay.title);
    if (title && target.indexOf(title) !== -1) score += 100;

    const terms = ESSAY_TYPE_TERMS[essay.type] || [];
    for (const term of terms) {
      if (target.indexOf(normalize(term)) !== -1) {
        score += 50;
        break;
      }
    }

    /*
     * 키워드는 사용자가 "이 문항에는 이 답변" 하고 직접 지정한 신호다.
     * 하나만 맞아도 임계값을 넘어야 한다 — 넘지 못하면 이 입력칸이 아무 일도 하지 않는다.
     */
    for (const keyword of essay.keywords || []) {
      const normalized = normalize(keyword);
      if (normalized && target.indexOf(normalized) !== -1) score += KEYWORD_WEIGHT;
    }

    if (score === 0) {
      const tokens = titleTokens(essay.title);
      const hits = tokens.filter((token) => target.indexOf(token) !== -1).length;
      if (tokens.length > 0 && hits > 0) {
        score += Math.round((hits / tokens.length) * 45);
      }
    }

    return score;
  }

  /** 이 칸이 받을 수 있는 최대 글자수 (제한이 없으면 null) */
  function fieldLimit(el) {
    const max = Number(el.getAttribute('maxlength'));
    return Number.isFinite(max) && max > 0 ? max : null;
  }

  /**
   * 장문 칸들에 문항을 배정한다.
   * 점수가 높은 쌍부터 채우고, 한 문항은 한 칸에만 들어간다.
   */
  /**
   * 매칭에 쓸 문항 목록.
   *
   * 대시보드가 essays를 넘기기 전 버전에서 동기화한 사용자는 storage에
   * syncedEssays가 없다. 그 경우에도 예전처럼 자기소개서 한 칸은 채워지도록
   * coverLetter를 제목 없는 문항 하나로 만들어 둔다.
   * 제목이 없으니 점수는 0이고, 아래 '칸이 하나뿐일 때' 경로로만 쓰인다.
   */
  function essayPool() {
    if (essays.length > 0) return essays;
    if (!profile.coverLetter) return [];

    return [{
      title: '',
      type: null,
      keywords: [],
      charLimit: null,
      isDefault: true,
      content: profile.coverLetter
    }];
  }

  function assignEssays(fields) {
    const pool = essayPool();
    const pairs = [];

    fields.forEach((field, fieldIndex) => {
      pool.forEach((essay, essayIndex) => {
        const score = scoreEssay(field.haystack, essay);
        if (score >= MATCH_THRESHOLD) {
          pairs.push({ fieldIndex, essayIndex, score });
        }
      });
    });

    pairs.sort((a, b) => b.score - a.score);

    const assigned = new Map();
    const usedEssays = new Set();

    for (const pair of pairs) {
      if (assigned.has(pair.fieldIndex)) continue;
      if (usedEssays.has(pair.essayIndex)) continue;

      assigned.set(pair.fieldIndex, pool[pair.essayIndex]);
      usedEssays.add(pair.essayIndex);
    }

    /*
     * 칸이 하나뿐일 때만 fallback을 쓴다.
     * 여러 칸에 fallback을 쓰면 같은 글이 중복되는 원래 문제로 되돌아간다.
     */
    if (fields.length === 1 && !assigned.has(0) && pool.length > 0) {
      const fallback =
        pool.find((essay) => essay.isDefault) ||
        pool.find((essay) => essay.type === 'MOTIVATION') ||
        pool[0];
      assigned.set(0, fallback);
    }

    return assigned;
  }

  /* ------------------------------------------------------------------ *
   * 5. 채울 수 있는 필드인지 검사
   * ------------------------------------------------------------------ */
  /** 자소서 같은 장문을 넣어도 브라우저가 버리는 타입 */
  const LONG_TEXT_INCOMPATIBLE = new Set([
    'number', 'date', 'datetime-local', 'month', 'week', 'time', 'url', 'email', 'tel'
  ]);

  function isFillable(el) {
    if (el.closest('#autofill-fit-root')) return false;   // 확장 UI 자신 제외
    if (el.disabled || el.readOnly) return false;

    const tag = el.tagName.toLowerCase();

    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      // radio는 그룹 단위로 따로 처리하므로 여기서는 막는다.
      if (SKIP_TYPES.has(type)) return false;
    }

    if (!isVisible(el)) return false;

    if (!OVERWRITE_EXISTING && el.value && el.value.trim() !== '') return false;

    return true;
  }

  function isVisible(el) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return el.offsetParent !== null || style.position === 'fixed';
  }

  /**
   * select가 채울 수 있는 상태인가.
   *
   * select는 값이 비어 있어도 selectedIndex가 0('선택하세요')이라
   * el.value 검사만으로는 "이미 고른 것"과 구분되지 않는다.
   * 실제로 의미 있는 값이 골라져 있을 때만 건너뛴다.
   */
  function isFillableSelect(el) {
    if (el.closest('#autofill-fit-root')) return false;
    if (el.disabled) return false;
    if (!isVisible(el)) return false;

    if (!OVERWRITE_EXISTING) {
      const chosen = el.options[el.selectedIndex];
      const hasValue = el.value && el.value.trim() !== '';
      const looksPlaceholder =
        !chosen || /^(선택|선택하세요|선택해\s?주세요|choose|select)/i.test(
          (chosen.textContent || '').trim()
        );
      if (hasValue && !looksPlaceholder) return false;
    }

    return true;
  }

  /** 라디오 그룹을 name 기준으로 모은다. 이미 골라져 있으면 제외한다. */
  function collectRadioGroups() {
    const groups = new Map();

    for (const el of Array.from(document.querySelectorAll('input[type="radio"]'))) {
      if (el.closest('#autofill-fit-root')) continue;
      if (el.disabled) continue;
      if (!isVisible(el)) continue;

      const name = el.name || '';
      if (!name) continue;

      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(el);
    }

    const result = [];
    groups.forEach((inputs, name) => {
      if (!OVERWRITE_EXISTING && inputs.some((input) => input.checked)) return;
      result.push({ name: name, inputs: inputs });
    });
    return result;
  }

  /**
   * 라디오 그룹을 사용자에게 어떻게 부를 것인가.
   *
   * 개별 라디오의 라벨은 보기('대학교')라서, 그대로 쓰면 확인 패널에
   * "대학교 → 대학교"처럼 무엇을 고른 것인지 알 수 없는 줄이 생긴다.
   * 묶는 fieldset의 legend가 곧 질문이다.
   */
  function radioGroupLabel(group) {
    const first = group.inputs[0];
    const fieldset = first.closest('fieldset');
    const legend = fieldset ? fieldset.querySelector('legend') : null;

    const raw = (legend && legend.textContent) || group.name || '';
    const text = String(raw).replace(/\s+/g, ' ').trim();
    return text.length > 24 ? text.slice(0, 24) + '…' : text || '선택 항목';
  }

  /**
   * 라디오 그룹이 무엇을 묻는지.
   *
   * 개별 라디오의 라벨은 보기('남','여')라서 질문을 알 수 없다.
   * 묶는 fieldset의 legend나 공통 조상의 텍스트에서 질문을 찾아야 한다.
   */
  function radioGroupHaystack(group) {
    const first = group.inputs[0];
    const parts = [group.name];

    const fieldset = first.closest('fieldset');
    const legend = fieldset ? fieldset.querySelector('legend') : null;
    if (legend) parts.push(legend.textContent || '');

    const labelled = first.getAttribute('aria-labelledby');
    if (labelled) {
      const node = document.getElementById(labelled);
      if (node) parts.push(node.textContent || '');
    }

    // 그룹 전체를 감싸면서 다른 입력은 포함하지 않는 조상의 텍스트
    let scope = first.parentElement;
    for (let depth = 0; scope && depth < 4; depth++) {
      if (group.inputs.every((input) => scope.contains(input))) {
        const clone = scope.cloneNode(true);
        clone.querySelectorAll('input, select, textarea, label').forEach((n) => n.remove());
        const text = (clone.textContent || '').replace(/\s+/g, ' ').trim();
        if (text) { parts.push(text); break; }
      }
      scope = scope.parentElement;
    }

    return parts.join(' ').toLowerCase();
  }

  /* ------------------------------------------------------------------ *
   * 6. React / Vue 호환 값 주입
   *    - native value setter로 프레임워크의 value tracker를 우회
   *    - input / change 이벤트를 강제로 dispatch
   * ------------------------------------------------------------------ */
  function setNativeValue(el, value) {
    const proto = (el instanceof HTMLTextAreaElement)
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;

    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

    // 프레임워크가 인스턴스에 setter를 덮어씌운 경우에도 prototype 원본 setter를 사용
    if (descriptor && typeof descriptor.set === 'function') {
      descriptor.set.call(el, value);
    } else {
      el.value = value;
    }
  }

  /** 이 칸이 기대하는 형식을 읽는다 — placeholder·pattern·maxlength가 단서다. */
  function fieldFormatHints(el) {
    return [
      el.getAttribute('placeholder') || '',
      el.getAttribute('pattern') || '',
      el.getAttribute('title') || '',
      el.getAttribute('data-format') || ''
    ].join(' ');
  }

  const DATE_KEYS = new Set([
    'birthdate', 'graduationDate', 'admissionDate',
    'joinDate', 'leaveDate', 'certificateAcquiredAt'
  ]);

  /**
   * 저장값을 이 칸의 형식에 맞춘다.
   *
   * 서버는 전화번호를 숫자만으로 저장하는데 지원서는 대부분 하이픈을 요구하거나
   * 입력 중 자동으로 붙인다. 형식을 맞추지 않으면 유효성 검사에서 반려되거나,
   * 마스킹 때문에 값이 달라져 확장이 실패로 센다.
   */
  function formatForField(el, key, value) {
    const text = String(value);

    if (key === 'phone') {
      const digits = text.replace(/[^0-9]/g, '');
      const hints = fieldFormatHints(el);
      const max = Number(el.getAttribute('maxlength'));
      const wantsHyphen =
        /-/.test(hints) || (Number.isFinite(max) && max >= 12 && max <= 13);

      if (!wantsHyphen) return digits;
      if (digits.length === 11) {
        return digits.slice(0, 3) + '-' + digits.slice(3, 7) + '-' + digits.slice(7);
      }
      if (digits.length === 10) {
        return digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6);
      }
      return digits;
    }

    if (DATE_KEYS.has(key)) {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      const parts = text.split('-');            // YYYY-MM 또는 YYYY-MM-DD

      if (type === 'date') return parts.length === 3 ? text : text;
      if (type === 'month') return parts.slice(0, 2).join('-');

      const hints = fieldFormatHints(el);
      const max = Number(el.getAttribute('maxlength'));

      // 구분자 없이 받는 칸 (YYYYMMDD)
      if (/^\s*$/.test(hints) === false && /[0-9]{4}[0-9]{2}/.test(hints.replace(/[^0-9]/g, ''))) {
        return parts.join('');
      }
      if (Number.isFinite(max) && (max === 8 || max === 6)) return parts.join('');
      if (hints.indexOf('.') !== -1) return parts.join('.');
      if (hints.indexOf('/') !== -1) return parts.join('/');

      return text;
    }

    return text;
  }

  /**
   * 값이 실제로 남았는가.
   *
   * 하이픈을 자동으로 붙이는 마스킹 칸은 넣은 문자열과 el.value가 달라진다.
   * 문자열이 정확히 같은지만 보면, 제대로 채워졌는데도 실패로 세어
   * '채울 수 있는 입력창을 찾지 못했습니다'를 띄운다.
   */
  function valueLanded(el, value) {
    const actual = el.value == null ? '' : String(el.value);
    if (actual === value) return true;
    if (actual.trim() === '') return false;

    const digitsOf = (text) => text.replace(/[^0-9a-z가-힣]/gi, '');
    return digitsOf(actual) === digitsOf(value);
  }

  function fillField(el, value) {
    el.focus();

    setNativeValue(el, value);

    // React 16+ 는 _valueTracker의 캐시값과 비교하므로 강제로 초기화
    if (el._valueTracker && typeof el._valueTracker.setValue === 'function') {
      el._valueTracker.setValue('');
    }

    // React / Vue / Angular를 모두 커버하도록 주요 이벤트를 순차 dispatch
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: '' }));

    /*
     * blur는 el.blur()로만 낸다.
     *
     * 예전에는 blur 이벤트를 직접 dispatch한 뒤 el.blur()를 또 불러
     * blur가 두 번 돌았다. 일부 폼 라이브러리는 blur마다 검증을 돌리므로
     * 같은 칸에 오류 메시지가 두 번 뜨거나, 첫 검증 결과가 두 번째로 덮인다.
     */
    el.blur();
  }

  /* ------------------------------------------------------------------ *
   * 7. 실행 엔트리
   * ------------------------------------------------------------------ */
  /**
   * 무엇을 어디에 넣을지 먼저 계산한다. 채우지는 않는다.
   *
   * 계산과 실행을 분리해야 미리보기와 되돌리기가 가능하다.
   * 예전에는 한 함수가 훑으면서 곧바로 채웠기 때문에, 사용자는 자소서 전문이
   * 들어간 뒤에야 토스트로 알았고 되돌릴 방법이 없었다.
   */
  function planAutoFill() {
    if (!hasSyncedProfile) return { items: [], skipped: [], notSynced: true };

    const all = Array.from(document.querySelectorAll('input, textarea'));
    const items = [];
    const skipped = [];

    /*
     * 1패스 — 장문 칸을 먼저 모은다.
     * 한 칸씩 즉시 배정하면 어느 문항이 이미 쓰였는지 알 수 없어
     * 같은 답변이 여러 칸에 들어간다.
     */
    const longTextFields = [];

    for (const el of all) {
      if (!isFillable(el)) continue;

      const tag = el.tagName.toLowerCase();
      const haystack = buildHaystack(el);

      if (tag === 'textarea' || LONG_TEXT_HINT.test(haystack)) {
        // 장문을 받지 못하는 input은 넣어도 브라우저가 버린다.
        if (tag === 'input') {
          const type = (el.getAttribute('type') || 'text').toLowerCase();
          if (LONG_TEXT_INCOMPATIBLE.has(type)) continue;
        }
        longTextFields.push({ el, haystack, label: fieldLabelText(el) });
      }
    }

    const assignment = assignEssays(longTextFields);

    longTextFields.forEach((field, index) => {
      const essay = assignment.get(index);

      if (!essay) {
        // 확신이 없으면 비워 둔다. 잘못 채워진 자소서는 빈 자소서보다 나쁘다.
        skipped.push({ label: field.label, reason: 'no-match', el: field.el });
        return;
      }

      /*
       * 저장된 제한과 이 칸의 maxlength 중 작은 쪽을 넘으면 넣지 않는다.
       * 넣으면 문장 중간에서 잘린 채 제출된다.
       */
      const limits = [essay.charLimit, fieldLimit(field.el)].filter(
        (limit) => typeof limit === 'number' && limit > 0
      );
      const limit = limits.length ? Math.min.apply(null, limits) : null;

      if (limit !== null && essay.content.length > limit) {
        skipped.push({
          label: field.label,
          reason: 'too-long',
          length: essay.content.length,
          limit: limit,
          el: field.el
        });
        return;
      }

      items.push({
        el: field.el,
        kind: 'text',
        key: 'coverLetter',
        label: field.label,
        value: essay.content,
        /*
         * 자소서는 기본 해제로 둔다.
         * 길고, 개인적이고, 잘못 들어가면 손으로 지워야 복구된다.
         * 나머지 항목과 같은 무게로 다룰 수 없다.
         */
        defaultOn: false
      });
    });

    // 2패스 — 나머지 항목은 칸마다 독립이다.
    const longTextSet = new Set(longTextFields.map((field) => field.el));

    for (const el of all) {
      if (longTextSet.has(el)) continue;
      if (!isFillable(el)) continue;

      const matched = resolveValue(el);
      if (!matched || matched.key === 'coverLetter') continue;
      if (matched.value == null || matched.value === '') continue;

      items.push({
        el: el,
        kind: 'text',
        key: matched.key,
        label: fieldLabelText(el),
        value: formatForField(el, matched.key, matched.value),
        defaultOn: true
      });
    }

    /*
     * 3패스 — 선택형 칸.
     * 한국 지원서의 학력구분·졸업상태·성별·병역은 대부분 select와 radio다.
     */
    for (const el of Array.from(document.querySelectorAll('select'))) {
      if (!isFillableSelect(el)) continue;

      const matched = resolveChoice(buildHaystack(el));
      if (!matched || !matched.value) continue;

      const option = pickOption(el, matched.kind, matched.value);
      // 확신이 없으면 고르지 않는다. 틀린 학력이 들어간 지원서는 빈 칸보다 나쁘다.
      if (!option) continue;

      items.push({
        el: el,
        kind: 'choice',
        key: matched.key,
        label: fieldLabelText(el),
        value: (option.textContent || option.value).trim(),
        option: option,
        defaultOn: true
      });
    }

    for (const group of collectRadioGroups()) {
      const matched = resolveChoice(radioGroupHaystack(group));
      if (!matched || !matched.value) continue;

      const input = pickRadio(group.inputs, matched.kind, matched.value);
      if (!input) continue;

      items.push({
        el: input,
        kind: 'choice',
        key: matched.key,
        label: radioGroupLabel(group),
        value: (getLabelText(input) || input.value).trim(),
        option: input,
        defaultOn: true
      });
    }

    /*
     * 화면에 나타나는 순서로 정렬한다.
     *
     * 위의 패스는 장문 → 일반 → 선택형 순으로 도는데, 그 순서를 그대로 보여주면
     * 지원서 맨 아래 자소서가 패널 맨 위에 온다. 확인하라고 띄운 목록이
     * 실제 폼과 순서가 다르면 눈으로 대조할 수 없다.
     */
    items.sort((a, b) => {
      const position = a.el.compareDocumentPosition(b.el);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });

    return { items, skipped, notSynced: false };
  }

  /**
   * 계획대로 채운다.
   *
   * 채우기 전 값을 기록해 둔다. 기록이 없으면 되돌릴 수 없고,
   * 되돌릴 수 없으면 사용자는 잘못 채워진 칸을 손으로 지워야 한다.
   */
  function applyPlan(plan, chosen) {
    let filled = 0;
    const summary = {};
    const undo = [];

    for (let i = 0; i < plan.items.length; i++) {
      if (!chosen.has(i)) continue;
      const item = plan.items[i];

      if (item.kind === 'choice') {
        const before =
          item.el.tagName.toLowerCase() === 'select'
            ? { type: 'select', value: item.el.value, index: item.el.selectedIndex }
            : { type: 'radio', checked: item.el.checked };

        if (!fillChoice(item.el, item.option)) continue;

        undo.push({ el: item.el, before: before });
        highlight(item.el.closest('label') || item.el);
      } else {
        const before = { type: 'text', value: item.el.value };

        fillField(item.el, item.value);
        if (!valueLanded(item.el, item.value)) continue;

        undo.push({ el: item.el, before: before });
        highlight(item.el);
      }

      summary[item.key] = (summary[item.key] || 0) + 1;
      filled += 1;
    }

    markSkippedFields(plan.skipped);

    if (filled > 0) recordFillEvent(filled);

    return { filled, summary, skipped: plan.skipped, undo };
  }

  /**
   * 건너뛴 칸에 표시를 남긴다.
   *
   * 확인 패널 단계가 아니라 실행 뒤에 칠한다. 미리보기에서 칠하면
   * 아직 아무 일도 일어나지 않았는데 경고가 먼저 뜬다.
   * 채울 항목이 하나도 없어 패널을 건너뛰는 경로에서도 반드시 불러야 한다 —
   * 그러지 않으면 "전부 제한 초과"인 지원서에서 표시가 하나도 남지 않는다.
   */
  function markSkippedFields(skipped) {
    for (const item of skipped) {
      if (item.el) markSkipped(item.el);
    }
  }

  /** 채우기 직전 상태로 되돌린다. */
  function revertFill(undo) {
    for (const entry of undo) {
      const el = entry.el;
      const before = entry.before;

      try {
        if (before.type === 'text') {
          fillField(el, before.value);
        } else if (before.type === 'select') {
          el.value = before.value;
          if (el.value !== before.value) el.selectedIndex = before.index;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          el.checked = before.checked;
          el.dispatchEvent(new Event('click', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        el.classList.remove('autofill-fit-highlight');
      } catch (_) {
        /* 페이지가 그 사이 바뀌었으면 되돌릴 대상이 없다 */
      }
    }
  }

  function highlight(el) {
    el.classList.add('autofill-fit-highlight');
    setTimeout(() => el.classList.remove('autofill-fit-highlight'), 1500);
  }

  /**
   * 비워 둔 칸에 표시를 남긴다.
   *
   * 토스트는 몇 초 뒤 사라지는데, 그 뒤에는 "확장이 일부러 비워 둔 칸"과
   * "확장이 아예 보지 않은 칸"이 똑같아 보인다. 그대로 제출하게 된다.
   * 사용자가 그 칸에 손을 대는 순간 표시를 거둔다.
   */
  function markSkipped(el) {
    el.classList.add('autofill-fit-skipped');

    const clear = () => {
      el.classList.remove('autofill-fit-skipped');
      el.removeEventListener('focus', clear);
      el.removeEventListener('input', clear);
    };

    el.addEventListener('focus', clear);
    el.addEventListener('input', clear);
  }

  /**
   * 사용자에게 보여줄 칸 이름.
   *
   * 지원서 라벨은 보통 "3. 입사 후 포부를 작성해 주세요 (200자 이내)" 꼴이다.
   * 번호와 괄호 안내를 떼지 않고 자르면 '(200…'에서 끊겨 무슨 칸인지 사라진다.
   */
  function fieldLabelText(el) {
    const raw = getLabelText(el) || el.getAttribute('placeholder') || el.name || '';
    const text = String(raw)
      .replace(/\s+/g, ' ')
      .replace(/^[\s]*[0-9]{1,2}\s*[.)]\s*/, '')   // 앞 번호
      .replace(/\s*[([][^)\]]*[)\]]\s*$/, '')       // 끝 괄호 안내
      .replace(/\s*(을|를)?\s*(작성|서술|기술)해\s*주세요\.?$/, '')
      .trim();

    return text.length > 24 ? text.slice(0, 24) + '…' : text || '이름 없는 칸';
  }

  /**
   * 자동 채움 이력.
   * 서버에 남기려면 확장에 별도 로그인이 필요하므로, 이 브라우저 안에만 남긴다.
   * 대시보드는 브리지를 통해 이 기록을 읽어 "마지막 자동 채움"을 보여준다.
   */
  const HISTORY_LIMIT = 20;

  function recordFillEvent(filled) {
    try {
      if (!chrome || !chrome.storage || !chrome.storage.local) return;

      chrome.storage.local.get(['fillHistory'], (stored) => {
        if (chrome.runtime.lastError) return;

        const history = Array.isArray(stored.fillHistory)
          ? stored.fillHistory
          : [];

        history.unshift({
          host: location.host,
          filled: filled,
          at: new Date().toISOString()
        });

        chrome.storage.local.set({
          fillHistory: history.slice(0, HISTORY_LIMIT)
        });
      });
    } catch (_) {
      /* 기록 실패가 자동 입력을 막아서는 안 된다. */
    }
  }

  /* ------------------------------------------------------------------ *
   * 8. 플로팅 버튼 & 토스트 UI
   * ------------------------------------------------------------------ */
  const LABELS = {
    name: '이름',
    email: '이메일',
    phone: '전화번호',
    birthdate: '생년월일',
    address: '주소',
    zipCode: '우편번호',
    schoolName: '학교',
    major: '전공',
    degree: '학력',
    status: '졸업구분',
    gpa: '학점',
    gpaScale: '학점만점',
    graduationDate: '졸업년월',
    admissionDate: '입학년월',
    companyName: '회사',
    department: '부서',
    jobTitle: '직무',
    position: '직급',
    joinDate: '입사년월',
    leaveDate: '퇴사년월',
    certificateName: '자격증',
    certificateIssuer: '발급기관',
    certificateAcquiredAt: '취득일',
    coverLetter: '자기소개서'
  };

  let toastTimer = null;

  function hasSkipped(result) {
    return Array.isArray(result.skipped) && result.skipped.length > 0;
  }

  /**
   * 왜 비워 뒀는지 한 줄에 하나씩 설명한다.
   *
   * 한 문장으로 이어 붙이면 실제 지원서에서 세 줄짜리 덩어리가 되어 읽히지 않는다.
   * 이 안내는 "다 채워진 줄 알고 제출"을 막는 유일한 장치라 읽혀야 한다.
   */
  function describeSkipped(skipped) {
    if (!Array.isArray(skipped) || skipped.length === 0) return [];

    const tooLong = skipped.filter((item) => item.reason === 'too-long');
    const noMatch = skipped.filter((item) => item.reason === 'no-match');
    const lines = [];

    for (const item of tooLong.slice(0, 2)) {
      lines.push(
        '「' + item.label + '」 ' +
        item.length.toLocaleString() + '자 → ' +
        item.limit.toLocaleString() + '자 제한을 넘어 비워 뒀습니다'
      );
    }
    if (tooLong.length > 2) {
      lines.push('그 밖에 ' + (tooLong.length - 2) + '칸도 제한을 넘었습니다');
    }

    if (noMatch.length > 0) {
      lines.push(
        '맞는 문항을 찾지 못한 ' + noMatch.length + '칸(' +
        noMatch.slice(0, 2).map((item) => item.label).join(', ') +
        (noMatch.length > 2 ? ' 외' : '') +
        ')은 직접 작성해 주세요'
      );
    }

    return lines;
  }

  /**
   * @param headline 첫 줄(무엇을 했는가)
   * @param notes    비워 둔 칸 설명. 한 줄에 하나씩 쌓는다.
   */
  function showToast(root, headline, isError, notes) {
    let toast = root.querySelector('.autofill-fit-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'autofill-fit-toast';
      root.appendChild(toast);
    }

    toast.textContent = '';

    const head = document.createElement('div');
    head.className = 'autofill-fit-toast-head';
    head.textContent = headline;
    toast.appendChild(head);

    const list = Array.isArray(notes) ? notes : [];
    for (const note of list) {
      const line = document.createElement('div');
      line.className = 'autofill-fit-toast-note';
      line.textContent = note;
      toast.appendChild(line);
    }

    toast.classList.toggle('is-error', !!isError);
    toast.classList.add('is-visible');

    // 읽을 것이 늘어나면 그만큼 오래 띄운다 — 2.6초로는 경고를 놓친다.
    clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => toast.classList.remove('is-visible'),
      2600 + list.length * 1800
    );
  }

  /* ------------------------------------------------------------------ *
   * 9.5 입력 전 확인 · 되돌리기 · 도메인 허용
   *
   * 확장은 모든 사이트에 주입되고, 버튼 한 번에 27개 규칙이 돈다.
   * LONG_TEXT_HINT는 '자기소개'만 걸리면 매칭되므로 커뮤니티 가입 폼의
   * '자기소개' 칸에도 지원용 자소서 전문이 들어간다. 자소서에는 보통
   * 이전 직장명과 출신 학교가 들어 있어, 한 번의 오입력이 곧 유출이다.
   *
   * 그래서 넣기 전에 무엇이 어디로 가는지 보여주고 확인을 받는다.
   * ------------------------------------------------------------------ */

  /** 되돌리기 버튼을 띄워 두는 시간. 짧으면 눌러 보기도 전에 사라진다. */
  const UNDO_WINDOW_MS = 12000;

  let undoTimer = null;

  /** 이 사이트에서 계속 쓰기로 한 도메인 목록 */
  let allowedHosts = [];

  function loadAllowedHosts() {
    try {
      chrome.storage.local.get(['allowedHosts'], function (stored) {
        if (chrome.runtime.lastError) return;
        allowedHosts = Array.isArray(stored && stored.allowedHosts)
          ? stored.allowedHosts
          : [];
      });
    } catch (_) {
      /* storage를 못 읽으면 매번 확인을 받는다 — 안전한 쪽이다 */
    }
  }

  function isAllowedHost() {
    return allowedHosts.indexOf(location.host) !== -1;
  }

  function rememberHost() {
    if (isAllowedHost()) return;
    allowedHosts = allowedHosts.concat([location.host]);
    try {
      chrome.storage.local.set({ allowedHosts: allowedHosts });
    } catch (_) {
      /* 저장 실패해도 이번 세션은 진행한다 */
    }
  }

  /** 이 기간이 지난 이력서는 그대로 내도 되는지 다시 보게 한다. */
  const STALE_AFTER_DAYS = 30;

  /**
   * 확인 패널에 띄울 이력서 기준 시각.
   *
   * 사용자는 "지금 채워지는 내용이 언제 쓴 것인지"를 모른 채 제출한다.
   * 두 달 전 경력으로 지원서를 내는 사고는 여기서만 막을 수 있다.
   */
  function freshnessNote() {
    const iso = resumeUpdatedAt || syncedAt;
    if (!iso) return null;

    const at = new Date(iso);
    if (isNaN(at.getTime())) return null;

    const days = Math.floor((Date.now() - at.getTime()) / 86400000);
    const when =
      at.getFullYear() + '년 ' + (at.getMonth() + 1) + '월 ' + at.getDate() + '일';

    if (days <= 0) return { text: '오늘 저장한 이력서입니다', stale: false };
    if (days < STALE_AFTER_DAYS) {
      return { text: when + ' 저장 (' + days + '일 전)', stale: false };
    }
    return {
      text: when + ' 저장 — ' + days + '일 지났습니다. 최신인지 확인해 주세요',
      stale: true
    };
  }

  /** 값이 길면 잘라서 보여준다. 미리보기가 화면을 덮으면 확인이 안 된다. */
  function previewText(value) {
    const text = String(value).replace(/\s+/g, ' ').trim();
    return text.length > 42 ? text.slice(0, 42) + '…' : text;
  }

  /**
   * 확인 패널을 띄우고, 사용자가 고른 항목으로 채운다.
   * 취소하면 아무 일도 일어나지 않는다.
   */
  function showConfirmPanel(root, plan, onDone) {
    const existing = root.querySelector('.autofill-fit-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.className = 'autofill-fit-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', '자동 입력할 항목 확인');

    const head = document.createElement('div');
    head.className = 'autofill-fit-panel__head';

    const title = document.createElement('div');
    title.className = 'autofill-fit-panel__title';
    title.textContent = location.host;

    const sub = document.createElement('div');
    sub.className = 'autofill-fit-panel__sub';
    sub.textContent = plan.items.length + '개 항목을 이 사이트에 입력합니다';

    head.appendChild(title);
    head.appendChild(sub);

    const freshness = freshnessNote();
    if (freshness) {
      const note = document.createElement('div');
      note.className =
        'autofill-fit-panel__freshness' + (freshness.stale ? ' is-stale' : '');
      note.textContent = freshness.text;
      head.appendChild(note);
    }

    panel.appendChild(head);

    const list = document.createElement('div');
    list.className = 'autofill-fit-panel__list';

    const chosen = new Set();

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'autofill-fit-panel__confirm';

    const syncConfirm = function () {
      confirmBtn.textContent = '선택한 ' + chosen.size + '개 입력';
      confirmBtn.disabled = chosen.size === 0;
    };

    plan.items.forEach(function (item, index) {
      if (item.defaultOn) chosen.add(index);

      const row = document.createElement('label');
      row.className = 'autofill-fit-row';

      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = item.defaultOn;
      box.addEventListener('change', function () {
        if (box.checked) chosen.add(index);
        else chosen.delete(index);
        syncConfirm();
      });

      const body = document.createElement('span');
      body.className = 'autofill-fit-row__body';

      const label = document.createElement('span');
      label.className = 'autofill-fit-row__label';
      label.textContent = item.label;

      const value = document.createElement('span');
      value.className = 'autofill-fit-row__value';
      value.textContent = previewText(item.value);

      body.appendChild(label);
      body.appendChild(value);

      row.appendChild(box);
      row.appendChild(body);

      // 자소서는 기본 해제다. 왜 꺼져 있는지 밝혀 두지 않으면 버그로 보인다.
      if (!item.defaultOn) {
        const note = document.createElement('span');
        note.className = 'autofill-fit-row__note';
        note.textContent = '길어서 기본 해제';
        row.appendChild(note);
      }

      list.appendChild(row);
    });

    syncConfirm();
    panel.appendChild(list);

    const foot = document.createElement('div');
    foot.className = 'autofill-fit-panel__foot';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'autofill-fit-panel__cancel';
    cancelBtn.textContent = '취소';

    const remember = document.createElement('label');
    remember.className = 'autofill-fit-panel__remember';
    const rememberBox = document.createElement('input');
    rememberBox.type = 'checkbox';
    const rememberText = document.createElement('span');
    rememberText.textContent = '이 사이트에서는 다음부터 묻지 않기';
    remember.appendChild(rememberBox);
    remember.appendChild(rememberText);

    foot.appendChild(confirmBtn);
    foot.appendChild(cancelBtn);
    panel.appendChild(foot);
    panel.appendChild(remember);

    const close = function () {
      panel.remove();
    };

    cancelBtn.addEventListener('click', close);
    confirmBtn.addEventListener('click', function () {
      if (rememberBox.checked) rememberHost();
      close();
      onDone(chosen);
    });

    root.appendChild(panel);
    return panel;
  }

  /**
   * 아직 비어 있는 필수 칸을 센다.
   *
   * 확장이 20칸을 채워 주면 사용자는 다 됐다고 믿는다. 그런데 증명사진(file),
   * 동의 체크박스, 확장이 손대지 않은 select는 여전히 비어 있고,
   * 그대로 제출하면 필수값 누락으로 반려된다.
   *
   * 채운 개수만 보고하는 것으로는 부족하다. 남은 것도 세어 준다.
   */
  function findRemainingRequired() {
    const nodes = Array.from(
      document.querySelectorAll(
        'input[required], select[required], textarea[required], ' +
        '[aria-required="true"]'
      )
    );

    const remaining = [];
    const seenRadioGroups = new Set();

    for (const el of nodes) {
      if (el.closest('#autofill-fit-root')) continue;
      if (el.disabled) continue;
      if (!isVisible(el)) continue;

      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute('type') || '').toLowerCase();

      if (type === 'radio' || type === 'checkbox') {
        // 라디오는 그룹 단위로 한 번만 센다.
        const name = el.name || '';
        if (type === 'radio') {
          if (seenRadioGroups.has(name)) continue;
          seenRadioGroups.add(name);
          const group = Array.from(
            document.querySelectorAll('input[type="radio"][name="' + CSS.escape(name) + '"]')
          );
          if (group.some((input) => input.checked)) continue;
        } else if (el.checked) {
          continue;
        }
      } else if (tag === 'select') {
        if (el.value && el.value.trim() !== '') continue;
      } else if (type === 'file') {
        if (el.files && el.files.length > 0) continue;
      } else if (el.value && el.value.trim() !== '') {
        continue;
      }

      remaining.push({ el: el, label: fieldLabelText(el), type: type || tag });
    }

    return remaining;
  }

  /** 남은 칸을 알리고, 누르면 그 칸으로 데려간다. */
  function showRemaining(root, remaining) {
    const existing = root.querySelector('.autofill-fit-remaining');
    if (existing) existing.remove();
    if (remaining.length === 0) return;

    const bar = document.createElement('button');
    bar.type = 'button';
    bar.className = 'autofill-fit-remaining';

    // 파일 칸은 확장이 영원히 채울 수 없으므로 따로 알려 준다.
    const files = remaining.filter((item) => item.type === 'file');
    bar.textContent =
      '아직 비어 있는 필수 칸 ' + remaining.length + '개' +
      (files.length > 0 ? ' (첨부 ' + files.length + '개 포함)' : '');

    let cursor = 0;
    bar.addEventListener('click', function () {
      const target = remaining[cursor % remaining.length];
      cursor += 1;

      try {
        target.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        markSkipped(target.el);
      } catch (_) {
        /* 그 사이 페이지가 바뀌었으면 넘어간다 */
      }
    });

    root.appendChild(bar);
  }

  /** 채운 직후 되돌릴 기회를 준다. */
  function showUndo(root, undo) {
    const existing = root.querySelector('.autofill-fit-undo');
    if (existing) existing.remove();
    if (undo.length === 0) return;

    const bar = document.createElement('button');
    bar.type = 'button';
    bar.className = 'autofill-fit-undo';
    bar.textContent = '되돌리기 (' + undo.length + '개)';

    bar.addEventListener('click', function () {
      revertFill(undo);
      bar.remove();
      showToast(root, '되돌렸습니다.', false, []);
    });

    root.appendChild(bar);

    clearTimeout(undoTimer);
    undoTimer = setTimeout(function () {
      bar.remove();
    }, UNDO_WINDOW_MS);
  }

  /** 결과를 토스트로 보고한다. */
  function reportResult(root, result) {
    if (result.filled === 0 && !hasSkipped(result)) {
      showToast(root, '채울 수 있는 입력창을 찾지 못했습니다.', true);
      return;
    }

    const detail = Object.keys(result.summary)
      .map(function (k) {
        return (LABELS[k] || k) + ' ' + result.summary[k];
      })
      .join(' · ');

    /*
     * 비워 둔 칸을 알리지 않으면 사용자는 다 채워진 줄 알고 제출한다.
     * 채운 개수만 말하는 것은 절반의 보고다.
     */
    const notes = describeSkipped(result.skipped);
    const headline = result.filled > 0
      ? result.filled + '개 입력 완료 (' + detail + ')'
      : '채우지 못했습니다.';

    showToast(root, headline, result.filled === 0, notes);
  }

  function createUI() {
    if (document.getElementById('autofill-fit-root')) return;

    const root = document.createElement('div');
    root.id = 'autofill-fit-root';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'autofill-fit-btn';
    button.setAttribute('aria-label', 'AutoFill-Fit 자동 입력 실행');

    const icon = document.createElement('span');
    icon.className = 'autofill-fit-btn__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '⚡';

    const text = document.createElement('span');
    text.className = 'autofill-fit-btn__text';
    text.textContent = 'AutoFill-Fit';

    button.appendChild(icon);
    button.appendChild(text);

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      button.classList.add('is-busy');
      try {
        const plan = planAutoFill();

        if (plan.notSynced) {
          showToast(
            root,
            '먼저 대시보드에서 "이력서 전달"을 눌러 주세요.',
            true
          );
        } else if (plan.items.length === 0) {
          // 채울 것이 없으면 확인 패널을 띄울 이유도 없다.
          // 다만 비워 둔 칸 표시는 이 경로에서도 남겨야 한다.
          markSkippedFields(plan.skipped);
          reportResult(root, { filled: 0, summary: {}, skipped: plan.skipped });
        } else {
          const run = function (chosen) {
            const result = applyPlan(plan, chosen);
            reportResult(root, result);
            showUndo(root, result.undo);
            // 채운 뒤에 세야 한다. 채우기 전에 세면 곧 채워질 칸까지 포함된다.
            showRemaining(root, findRemainingRequired());
          };

          if (isAllowedHost()) {
            // 이미 허용한 사이트는 매번 묻지 않는다. 되돌리기는 그대로 준다.
            const auto = new Set();
            plan.items.forEach(function (item, i) {
              if (item.defaultOn) auto.add(i);
            });
            run(auto);
          } else {
            showConfirmPanel(root, plan, run);
          }
        }
      } catch (err) {
        console.error('[AutoFill-Fit]', err);
        showToast(root, '자동 입력 중 오류가 발생했습니다.', true);
      } finally {
        setTimeout(() => button.classList.remove('is-busy'), 300);
      }
    });

    root.appendChild(button);
    (document.body || document.documentElement).appendChild(root);
  }


  /* ------------------------------------------------------------------ *
   * 10. 대시보드 브리지
   *     확장 ID를 몰라도 되도록 postMessage로 핸드셰이크한다.
   *     (externally_connectable은 unpacked 확장의 임의 ID를 알아야 해서 개발이 번거롭다.)
   * ------------------------------------------------------------------ */

  /**
   * 이 페이지들에만 응답한다.
   * 아무 사이트나 확장 존재 여부와 이력을 읽어가지 못하게 막는 것이 목적이다.
   * 운영 도메인을 배포할 때 여기에 추가해야 한다.
   */
  const TRUSTED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3021',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
  ];

  const EXTENSION_VERSION =
    (chrome && chrome.runtime && chrome.runtime.getManifest)
      ? chrome.runtime.getManifest().version
      : '0.0.0';

  function isTrustedOrigin() {
    return TRUSTED_ORIGINS.indexOf(location.origin) !== -1;
  }

  function reply(payload) {
    window.postMessage(
      Object.assign({ source: 'autofill-fit-extension' }, payload),
      location.origin
    );
  }

  function handleBridgeMessage(event) {
    // 같은 창에서 온 메시지만 신뢰한다 (iframe/외부 창 차단).
    if (event.source !== window) return;
    // origin까지 확인한다. source 검사만으로는 같은 창 안의 다른 스크립트를 막지 못한다.
    if (event.origin !== location.origin) return;
    if (!event.data || event.data.source !== 'autofill-fit-web') return;
    if (!isTrustedOrigin()) return;

    // 확장이 리로드되면 이 리스너는 남지만 chrome.* 는 무효가 된다.
    // 그대로 두면 대시보드는 응답을 영원히 기다린다.
    try {
      if (!chrome.runtime || !chrome.runtime.id) throw new Error('invalidated');
    } catch (_) {
      window.removeEventListener('message', handleBridgeMessage);
      return;
    }

    if (event.data.type === 'PING') {
      chrome.storage.local.get(['fillHistory', 'syncedAt'], (stored) => {
        reply({
          type: 'PONG',
          version: EXTENSION_VERSION,
          syncedAt: stored.syncedAt || null,
          history: Array.isArray(stored.fillHistory)
            ? stored.fillHistory.slice(0, 5)
            : []
        });
      });
      return;
    }

    // 대시보드에서 로그아웃하면 이 기기에 남은 개인정보를 지운다.
    // 지우지 않으면 같은 브라우저의 다음 사용자에게 넘어간다.
    if (event.data.type === 'CLEAR') {
      chrome.storage.local.remove(
        [
          'syncedProfile', 'syncedEssays', 'syncedAt', 'fillHistory',
          'syncedEducation', 'syncedCareers', 'syncedCertificates',
          'resumeUpdatedAt'
        ],
        () => {
          profile = { ...DEFAULT_PROFILE };
          essays = [];
          education = [];
          careers = [];
          certificates = [];
          hasSyncedProfile = false;
          syncedAt = null;
          resumeUpdatedAt = null;
          reply({ type: 'CLEARED' });
        }
      );
      return;
    }

    // 대시보드가 최신 이력서를 넘겨준다. 토큰은 받지 않는다 — 확장에 둘 이유가 없다.
    if (event.data.type === 'SYNC' && event.data.profile) {
      const at = new Date().toISOString();
      const asList = (value) => (Array.isArray(value) ? value : []);

      const incomingEssays = asList(event.data.essays);
      const incomingEducation = asList(event.data.education);
      const incomingCareers = asList(event.data.careers);
      const incomingCertificates = asList(event.data.certificates);

      chrome.storage.local.set(
        {
          syncedProfile: event.data.profile,
          syncedEssays: incomingEssays,
          syncedEducation: incomingEducation,
          syncedCareers: incomingCareers,
          syncedCertificates: incomingCertificates,
          resumeUpdatedAt: event.data.resumeUpdatedAt || null,
          syncedAt: at
        },
        () => {
          // 실패를 성공으로 보고하면 대시보드가 전달됐다고 거짓말한다.
          if (chrome.runtime.lastError) {
            reply({
              type: 'SYNC_FAILED',
              message: chrome.runtime.lastError.message || '저장에 실패했습니다.'
            });
            return;
          }

          profile = Object.assign({}, DEFAULT_PROFILE, event.data.profile);
          essays = incomingEssays;
          education = incomingEducation;
          careers = incomingCareers;
          certificates = incomingCertificates;
          resumeUpdatedAt = event.data.resumeUpdatedAt || null;
          hasSyncedProfile = true;
          syncedAt = at;
          reply({ type: 'SYNCED', syncedAt: at });
        }
      );
    }
  }

  window.addEventListener('message', handleBridgeMessage);

  /* ------------------------------------------------------------------ *
   * 11. 부트스트랩 — SPA에서 body가 교체돼도 버튼을 복구
   * ------------------------------------------------------------------ */
  function bootstrap() {
    loadProfile();
    loadAllowedHosts();
    watchProfileChanges();

    // 대시보드 자신에게는 자동 입력 버튼을 띄우지 않는다.
    // 여기서 채울 지원서가 없고, 자기 이력서 폼을 자기가 덮어쓰는 꼴이 된다.
    if (isTrustedOrigin()) return;

    createUI();

    const observer = new MutationObserver(() => {
      if (!document.getElementById('autofill-fit-root')) createUI();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
