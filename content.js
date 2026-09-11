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

  // 이미 값이 채워진 필드를 덮어쓸지 여부
  const OVERWRITE_EXISTING = false;

  /** 대시보드에서 동기화된 값 (chrome.storage.local) */
  let syncedAt = null;

  function loadProfile() {
    try {
      if (!chrome || !chrome.storage) return;

      // 대시보드가 넘겨준 값이 있으면 그것을 쓰고, 없으면 sync/기본값으로 내려간다.
      chrome.storage.local.get(
        ['syncedProfile', 'syncedAt', 'syncedEssays'],
        (local) => {
        if (chrome.runtime.lastError) return;

        essays = Array.isArray(local && local.syncedEssays)
          ? local.syncedEssays
          : [];

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
          }
        }

        if (changes.syncedEssays) {
          essays = Array.isArray(changes.syncedEssays.newValue)
            ? changes.syncedEssays.newValue
            : [];
        }

        if (changes.syncedAt) syncedAt = changes.syncedAt.newValue || null;
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
      exclude: /(company|corp|school|univ|file|card|nickname|domain|account|bank|project|team|product|회사|학교|파일|은행)/i,
      value: () => profile.name
    }
  ];

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

    if (el.tagName.toLowerCase() === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (SKIP_TYPES.has(type)) return false;
    }

    // 화면에 보이지 않는 필드 제외
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (el.offsetParent === null && style.position !== 'fixed') return false;

    if (!OVERWRITE_EXISTING && el.value && el.value.trim() !== '') return false;

    return true;
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
    el.dispatchEvent(new Event('blur', { bubbles: false }));

    el.blur();
  }

  /* ------------------------------------------------------------------ *
   * 7. 실행 엔트리
   * ------------------------------------------------------------------ */
  function runAutoFill() {
    // 대시보드에서 이력서를 받은 적이 없으면 아무것도 채우지 않는다.
    // 여기서 막지 않으면 빈 값이나 남은 값이 실제 지원서에 들어간다.
    if (!hasSyncedProfile) {
      return { filled: 0, summary: {}, notSynced: true };
    }

    const all = Array.from(document.querySelectorAll('input, textarea'));
    let filled = 0;
    const summary = {};
    const skipped = [];

    /*
     * 1패스 — 장문 칸을 먼저 모은다.
     * 한 칸씩 즉시 채우면 어느 문항이 이미 쓰였는지 알 수 없어
     * 같은 답변이 여러 칸에 들어간다. 배정을 먼저 끝내야 한다.
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

    // 2패스 — 배정 결과대로 채운다.
    longTextFields.forEach((field, index) => {
      const essay = assignment.get(index);

      if (!essay) {
        // 확신이 없으면 비워 둔다. 잘못 채워진 자소서는 빈 자소서보다 나쁘다.
        skipped.push({ label: field.label, reason: 'no-match' });
        markSkipped(field.el);
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
          limit: limit
        });
        markSkipped(field.el);
        return;
      }

      fillField(field.el, essay.content);
      if (field.el.value !== essay.content) return;

      highlight(field.el);
      summary.coverLetter = (summary.coverLetter || 0) + 1;
      filled += 1;
    });

    // 나머지 항목(이름·이메일·연락처)은 칸마다 독립이라 순서대로 처리한다.
    const longTextSet = new Set(longTextFields.map((field) => field.el));

    for (const el of all) {
      if (longTextSet.has(el)) continue;
      if (!isFillable(el)) continue;

      const matched = resolveValue(el);
      if (!matched || matched.key === 'coverLetter') continue;
      if (matched.value == null || matched.value === '') continue;

      fillField(el, matched.value);
      if (el.value !== matched.value) continue;

      highlight(el);
      summary[matched.key] = (summary[matched.key] || 0) + 1;
      filled += 1;
    }

    if (filled > 0) recordFillEvent(filled);

    return { filled, summary, skipped };
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
        const result = runAutoFill();
        if (result.notSynced) {
          showToast(
            root,
            '먼저 대시보드에서 "이력서 전달"을 눌러 주세요.',
            true
          );
        } else if (result.filled === 0 && !hasSkipped(result)) {
          showToast(root, '채울 수 있는 입력창을 찾지 못했습니다.', true);
        } else {
          const detail = Object.keys(result.summary)
            .map((k) => (LABELS[k] || k) + ' ' + result.summary[k])
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
        ['syncedProfile', 'syncedEssays', 'syncedAt', 'fillHistory'],
        () => {
          profile = { ...DEFAULT_PROFILE };
          essays = [];
          hasSyncedProfile = false;
          syncedAt = null;
          reply({ type: 'CLEARED' });
        }
      );
      return;
    }

    // 대시보드가 최신 이력서를 넘겨준다. 토큰은 받지 않는다 — 확장에 둘 이유가 없다.
    if (event.data.type === 'SYNC' && event.data.profile) {
      const at = new Date().toISOString();
      const incomingEssays = Array.isArray(event.data.essays)
        ? event.data.essays
        : [];

      chrome.storage.local.set(
        {
          syncedProfile: event.data.profile,
          syncedEssays: incomingEssays,
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
