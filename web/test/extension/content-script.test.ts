// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * content.js는 빌드 과정 없는 단일 IIFE라 import할 수 없다.
 * jsdom 안에서 그대로 실행하고, 페이지에 드러나는 동작(무엇이 채워지는가)으로 검증한다.
 *
 * 여기서 고정하는 것은 실제로 있었던 결함들이다:
 * - 대시보드에서 이력서를 받기 전에 더미 프로필이 실제 지원서에 채워졌다
 * - textarea면 무조건 자소서를 넣어, 배송 요청사항 같은 칸에 자소서 전문이 들어갔다
 * - 이웃 필드의 라벨을 흡수해 이름 칸에 이메일이 들어갔다
 */

const CONTENT_JS = readFileSync(
  path.resolve(__dirname, '../../../content.js'),
  'utf-8',
);

const PROFILE = {
  name: '홍길동',
  email: 'hong@example.com',
  phone: '01012345678',
  coverLetter: '귀사의 기술 문화에 공감하여 지원했습니다.',
};

/** chrome.storage.local의 최소 구현 */
function installChrome(local: Record<string, unknown>) {
  const listeners: Array<(changes: unknown, area: string) => void> = [];

  (globalThis as Record<string, unknown>).chrome = {
    runtime: { id: 'test-extension', lastError: undefined, getManifest: () => ({ version: '1.0.0' }) },
    storage: {
      local: {
        get: (keys: string[] | string, cb: (v: Record<string, unknown>) => void) => {
          const list = Array.isArray(keys) ? keys : [keys];
          const out: Record<string, unknown> = {};
          for (const k of list) if (k in local) out[k] = local[k];
          cb(out);
        },
        set: (values: Record<string, unknown>, cb?: () => void) => {
          Object.assign(local, values);
          cb?.();
        },
        remove: (keys: string[], cb?: () => void) => {
          for (const k of keys) delete local[k];
          cb?.();
        },
      },
      sync: {
        get: (defaults: Record<string, unknown>, cb: (v: Record<string, unknown>) => void) =>
          cb(defaults),
      },
      onChanged: {
        addListener: (fn: (changes: unknown, area: string) => void) => listeners.push(fn),
      },
    },
  };
}

/**
 * content.js를 실행하고 초기화가 끝날 때까지 기다린다.
 * <script> 태그로 넣으면 jsdom이 별도 VM 컨텍스트에서 돌려 테스트가 만든
 * chrome/location 스텁을 보지 못한다. 같은 컨텍스트에서 평가한다.
 */
async function loadContentScript() {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function(CONTENT_JS)();
  await new Promise((r) => setTimeout(r, 30));
}

/**
 * 버튼을 누르고 확인 패널까지 통과시킨다.
 *
 * 이제 채우기 전에 확인 패널이 뜬다. 기본 해제인 항목(자소서)까지
 * 전부 켜서 "예전처럼 다 채우는" 흐름을 재현한다.
 * 패널 자체의 동작은 아래 '입력 전 확인' describe에서 따로 검증한다.
 */
function clickAutofill() {
  const button = document.querySelector<HTMLElement>('.autofill-fit-btn');
  button?.click();
  confirmPanel();
}

/** 패널이 떠 있으면 모두 선택하고 확인을 누른다. */
function confirmPanel(selectAll = true) {
  const panel = document.querySelector('.autofill-fit-panel');
  if (!panel) return false;

  if (selectAll) {
    panel
      .querySelectorAll<HTMLInputElement>('.autofill-fit-row input[type="checkbox"]')
      .forEach((box) => {
        if (!box.checked) box.click();
      });
  }

  panel.querySelector<HTMLElement>('.autofill-fit-panel__confirm')?.click();
  return true;
}

/** 버튼만 누르고 패널은 그대로 둔다. */
function openPanel() {
  document.querySelector<HTMLElement>('.autofill-fit-btn')?.click();
  return document.querySelector('.autofill-fit-panel');
}

const value = (selector: string) =>
  document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)?.value ?? null;

const toastText = () =>
  document.querySelector('.autofill-fit-toast')?.textContent ?? null;

beforeEach(() => {
  document.body.innerHTML = '';
  delete (window as unknown as Record<string, unknown>).__autoFillFitInjected;

  /**
   * jsdom은 레이아웃을 계산하지 않아 offsetParent가 항상 null이다.
   * content.js의 "화면에 보이는가" 검사가 모든 필드를 걸러내므로,
   * 보이는 요소로 취급되도록 환경을 보정한다(제품 코드는 그대로 둔다).
   */
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() {
      return this.ownerDocument?.body ?? null;
    },
  });

  // content.js는 SPA에서 버튼을 복구하려고 MutationObserver를 붙인다.
  // 테스트가 끝난 뒤에도 살아남아 document를 참조하므로 여기서는 무력화한다.
  vi.stubGlobal(
    'MutationObserver',
    class {
      observe() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );

  vi.stubGlobal('location', { ...window.location, origin: 'https://jobs.example.com', host: 'jobs.example.com' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as Record<string, unknown>).chrome;
});

describe('동기화 게이트', () => {
  it('이력서를 받은 적이 없으면 아무것도 채우지 않는다', async () => {
    installChrome({});
    document.body.innerHTML = `
      <form>
        <label>이름 <input name="name"></label>
        <label>이메일 <input name="email"></label>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('input[name="name"]')).toBe('');
    expect(value('input[name="email"]')).toBe('');
    expect(toastText()).toContain('이력서 전달');
  });

  it('더미 값이 실제 지원서에 들어가지 않는다', async () => {
    installChrome({});
    document.body.innerHTML = '<form><label>이름 <input name="name"></label></form>';

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    // 과거 기본값이던 '홍길동'이 절대 나타나면 안 된다
    expect(document.body.innerHTML).not.toContain('홍길동');
    expect(document.body.innerHTML).not.toContain('hong@example.com');
  });
});

describe('전달받은 이력서로 채우기', () => {
  beforeEach(() => {
    installChrome({ syncedProfile: PROFILE, syncedAt: '2026-09-10T00:00:00.000Z' });
  });

  it('이름·이메일·연락처를 라벨로 찾아 채운다', async () => {
    document.body.innerHTML = `
      <form>
        <div><label for="a">이름</label><input id="a"></div>
        <div><label for="b">이메일</label><input id="b" type="email"></div>
        <div><label for="c">연락처</label><input id="c" type="tel"></div>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#a')).toBe(PROFILE.name);
    expect(value('#b')).toBe(PROFILE.email);
    expect(value('#c')).toBe(PROFILE.phone);
  });

  it('이미 값이 있는 칸은 덮어쓰지 않는다', async () => {
    document.body.innerHTML =
      '<form><div><label for="a">이름</label><input id="a" value="김철수"></div></form>';

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#a')).toBe('김철수');
  });
});

describe('자소서 매칭 범위', () => {
  beforeEach(() => {
    installChrome({ syncedProfile: PROFILE, syncedAt: '2026-09-10T00:00:00.000Z' });
  });

  it('자소서 힌트가 있는 칸에만 넣는다', async () => {
    document.body.innerHTML = `
      <form>
        <div><label for="ca">자기소개서</label><textarea id="ca"></textarea></div>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#ca')).toBe(PROFILE.coverLetter);
  });

  it('관련 없는 textarea에는 넣지 않는다 — 배송 요청사항에 자소서가 들어갔었다', async () => {
    document.body.innerHTML = `
      <form>
        <div><label for="memo">배송 요청사항</label><textarea id="memo"></textarea></div>
        <div><label for="q">문의 내용</label><textarea id="q"></textarea></div>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#memo')).toBe('');
    expect(value('#q')).toBe('');
  });
});

describe('라벨 오인식', () => {
  beforeEach(() => {
    installChrome({ syncedProfile: PROFILE, syncedAt: '2026-09-10T00:00:00.000Z' });
  });

  it('한 컨테이너에 입력이 여러 개면 이웃 라벨을 흡수하지 않는다', async () => {
    // 라벨 연결이 없고 입력만 나열된 경우 — 이름 칸에 이메일이 들어갔었다
    document.body.innerHTML = `
      <form>
        <div>
          이메일을 입력하세요
          <input name="field1">
          <input name="field2">
        </div>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('input[name="field1"]')).toBe('');
    expect(value('input[name="field2"]')).toBe('');
  });
});

describe('대시보드에서는 동작하지 않는다', () => {
  it('신뢰 origin에는 자동입력 버튼을 띄우지 않는다', async () => {
    vi.stubGlobal('location', {
      ...window.location,
      origin: 'http://localhost:3001',
      host: 'localhost:3001',
    });
    installChrome({ syncedProfile: PROFILE });
    document.body.innerHTML = '<form><input name="name"></form>';

    await loadContentScript();

    expect(document.getElementById('autofill-fit-root')).toBeNull();
  });
});

/**
 * 문항별 매칭.
 *
 * 이전에는 LONG_TEXT_HINT에 걸리는 모든 칸에 같은 문자열을 넣었다.
 * 문항이 2개 이상인 지원서는 예외가 아니라 기본값이고,
 * OVERWRITE_EXISTING=false라 잘못 채워지면 손으로 지워야 복구된다.
 */
const ESSAYS = [
  {
    title: '지원 동기',
    type: 'MOTIVATION',
    keywords: [],
    charLimit: null,
    isDefault: true,
    content: '결제 도메인을 계속 다루고 싶어 지원했습니다.',
  },
  {
    title: '성장 과정',
    type: 'GROWTH',
    keywords: [],
    charLimit: null,
    isDefault: false,
    content: '작은 팀에서 서버를 혼자 맡으며 자랐습니다.',
  },
  {
    title: '입사 후 포부',
    type: 'ASPIRATION',
    keywords: ['3년'],
    charLimit: null,
    isDefault: false,
    content: '3년 안에 결제 정산까지 책임지고 싶습니다.',
  },
];

const synced = (essays: unknown[] = ESSAYS) => ({
  syncedProfile: PROFILE,
  syncedAt: '2026-09-10T00:00:00.000Z',
  syncedEssays: essays,
});

describe('문항별 자소서 매칭', () => {
  it('문항 3개면 서로 다른 답변 3개가 들어간다', async () => {
    installChrome(synced());
    document.body.innerHTML = `
      <form>
        <div><label for="q1">지원 동기를 작성해 주세요</label><textarea id="q1"></textarea></div>
        <div><label for="q2">성장 과정을 작성해 주세요</label><textarea id="q2"></textarea></div>
        <div><label for="q3">입사 후 포부를 작성해 주세요</label><textarea id="q3"></textarea></div>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#q1')).toBe(ESSAYS[0].content);
    expect(value('#q2')).toBe(ESSAYS[1].content);
    expect(value('#q3')).toBe(ESSAYS[2].content);

    // 같은 글이 두 번 들어가지 않았다는 것 자체를 고정한다
    const filledValues = ['#q1', '#q2', '#q3'].map(value);
    expect(new Set(filledValues).size).toBe(3);
  });

  it('문항 순서가 바뀌어도 라벨을 따라간다', async () => {
    installChrome(synced());
    document.body.innerHTML = `
      <form>
        <div><label for="a">입사 후 포부</label><textarea id="a"></textarea></div>
        <div><label for="b">지원 동기</label><textarea id="b"></textarea></div>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#a')).toBe(ESSAYS[2].content);
    expect(value('#b')).toBe(ESSAYS[0].content);
  });

  it('매칭되지 않은 칸은 비워 두고 알려준다 — 아무거나 넣지 않는다', async () => {
    installChrome(synced([ESSAYS[0]]));
    document.body.innerHTML = `
      <form>
        <div><label for="q1">지원 동기</label><textarea id="q1"></textarea></div>
        <div><label for="q2">본인의 직무 경험을 서술하시오</label><textarea id="q2"></textarea></div>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#q1')).toBe(ESSAYS[0].content);
    // 예전에는 여기에도 같은 글이 들어갔다
    expect(value('#q2')).toBe('');
    expect(toastText()).toContain('직접 작성');
  });

  it('키워드로도 문항을 찾는다', async () => {
    installChrome(synced());
    document.body.innerHTML = `
      <form>
        <div><label for="q">3년 뒤 자신의 모습을 적어 주세요</label><textarea id="q"></textarea></div>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#q')).toBe(ESSAYS[2].content);
  });
});

describe('글자수 제한', () => {
  const long = 'ㄱ'.repeat(300);

  it('저장된 제한을 넘으면 넣지 않고 이유를 알려준다', async () => {
    installChrome(
      synced([
        { ...ESSAYS[0], content: long, charLimit: 100 },
      ]),
    );
    document.body.innerHTML =
      '<form><div><label for="q">지원 동기</label><textarea id="q"></textarea></div></form>';

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    // 잘린 채 제출되느니 비어 있는 편이 낫다
    expect(value('#q')).toBe('');
    expect(toastText()).toContain('300');
    expect(toastText()).toContain('100');
  });

  it('칸의 maxlength가 더 작으면 그쪽을 따른다', async () => {
    installChrome(synced([{ ...ESSAYS[0], content: long, charLimit: 1000 }]));
    document.body.innerHTML =
      '<form><div><label for="q">지원 동기</label><textarea id="q" maxlength="200"></textarea></div></form>';

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#q')).toBe('');
    expect(toastText()).toContain('200');
  });

  it('제한 안이면 그대로 넣는다', async () => {
    installChrome(synced([{ ...ESSAYS[0], charLimit: 1000 }]));
    document.body.innerHTML =
      '<form><div><label for="q">지원 동기</label><textarea id="q" maxlength="1000"></textarea></div></form>';

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#q')).toBe(ESSAYS[0].content);
  });
});

describe('예전 동기화 데이터 호환', () => {
  it('essays 없이 coverLetter만 있어도 한 칸짜리는 채운다', async () => {
    // 확장을 업데이트했지만 아직 재동기화하지 않은 사용자
    installChrome({ syncedProfile: PROFILE, syncedAt: '2026-09-10T00:00:00.000Z' });
    document.body.innerHTML =
      '<form><div><label for="q">자기소개서</label><textarea id="q"></textarea></div></form>';

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#q')).toBe(PROFILE.coverLetter);
  });

  it('그래도 여러 칸에 같은 글을 복사하지는 않는다', async () => {
    installChrome({ syncedProfile: PROFILE, syncedAt: '2026-09-10T00:00:00.000Z' });
    document.body.innerHTML = `
      <form>
        <div><label for="q1">지원 동기</label><textarea id="q1"></textarea></div>
        <div><label for="q2">성장 과정</label><textarea id="q2"></textarea></div>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#q1')).toBe('');
    expect(value('#q2')).toBe('');
  });
});

describe('비워 둔 칸 표시', () => {
  /**
   * 토스트는 몇 초 뒤 사라진다. 그 뒤에도 "일부러 비워 둔 칸"이
   * 구분되지 않으면 사용자는 그대로 제출한다.
   */
  it('건너뛴 칸에 표시가 남는다', async () => {
    installChrome(synced([ESSAYS[0]]));
    document.body.innerHTML = `
      <form>
        <div><label for="q1">지원 동기</label><textarea id="q1"></textarea></div>
        <div><label for="q2">기타 문의사항</label><textarea id="q2"></textarea></div>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(document.getElementById('q1')?.className).not.toContain('autofill-fit-skipped');
    expect(document.getElementById('q2')?.className).toContain('autofill-fit-skipped');
  });

  it('사용자가 그 칸에 손을 대면 표시를 거둔다', async () => {
    installChrome(synced([ESSAYS[0]]));
    document.body.innerHTML = `
      <form>
        <div><label for="q1">지원 동기</label><textarea id="q1"></textarea></div>
        <div><label for="q2">기타 문의사항</label><textarea id="q2"></textarea></div>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    const q2 = document.getElementById('q2') as HTMLTextAreaElement;
    // 표시가 붙어 있어야 '거둔다'를 검증할 수 있다
    expect(q2.className).toContain('autofill-fit-skipped');

    q2.dispatchEvent(new Event('focus'));

    expect(q2.className).not.toContain('autofill-fit-skipped');
  });

  it('제한을 넘어 비운 칸에도 표시가 남는다', async () => {
    installChrome(synced([{ ...ESSAYS[0], content: 'ㄱ'.repeat(300), charLimit: 100 }]));
    document.body.innerHTML =
      '<form><div><label for="q">지원 동기</label><textarea id="q"></textarea></div></form>';

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(document.getElementById('q')?.className).toContain('autofill-fit-skipped');
  });
});

describe('칸 이름 표시', () => {
  it('번호와 괄호 안내를 떼고 문항 이름만 남긴다', async () => {
    installChrome(synced([ESSAYS[0]]));
    document.body.innerHTML = `
      <form>
        <div><label for="q1">지원 동기</label><textarea id="q1"></textarea></div>
        <div>
          <label for="q2">4. 기타 문의사항을 작성해 주세요 (500자 이내)</label>
          <textarea id="q2"></textarea>
        </div>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    // 예전에는 '4. 기타 문의사항을 작성해 주세요 (500…'에서 잘렸다
    expect(toastText()).toContain('기타 문의사항');
    expect(toastText()).not.toContain('(500');
  });
});

/**
 * 전체 항목 자동입력.
 *
 * 대시보드는 4개 섹션 100점을 채우게 하는데, 확장에는 오랫동안
 * name·email·phone·coverLetter 4개만 전달됐다. 서버가 이미 내려주던
 * birthdate·address·zipCode조차 브리지에서 빠졌고, 학력 20점·경력 20점·
 * 자격증 10점은 전달 경로 자체가 없었다.
 */
const FULL_PROFILE = {
  ...PROFILE,
  birthdate: '1995-03-02',
  address: '서울시 강남구 테헤란로 123',
  zipCode: '06236',
};

const EDUCATION = [
  {
    schoolName: '한국대학교',
    major: '컴퓨터공학',
    degree: 'BACHELOR',
    status: 'GRADUATED',
    gpa: '3.85',
    gpaScale: '4.50',
    admissionDate: '2014-03',
    graduationDate: '2018-02',
  },
];

const CAREERS = [
  {
    companyName: '로지소프트',
    department: '플랫폼팀',
    jobTitle: '백엔드 개발',
    position: '주임',
    joinDate: '2020-01',
    leaveDate: null,
    isCurrent: true,
    mainTasks: '결제 API',
  },
];

const CERTIFICATES = [
  { name: '정보처리기사', issuer: '한국산업인력공단', acquiredAt: '2019-08-16', score: null },
];

const fullSync = (over: Record<string, unknown> = {}) => ({
  syncedProfile: FULL_PROFILE,
  syncedAt: '2026-09-10T00:00:00.000Z',
  syncedEssays: ESSAYS,
  syncedEducation: EDUCATION,
  syncedCareers: CAREERS,
  syncedCertificates: CERTIFICATES,
  ...over,
});

describe('인적사항 전체 입력', () => {
  it('생년월일·주소·우편번호도 채운다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = `
      <form>
        <div><label for="a">생년월일</label><input id="a"></div>
        <div><label for="b">주소</label><input id="b"></div>
        <div><label for="c">우편번호</label><input id="c"></div>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#a')).toBe('1995-03-02');
    expect(value('#b')).toBe('서울시 강남구 테헤란로 123');
    expect(value('#c')).toBe('06236');
  });

  it('우편번호 칸에 주소를 넣지 않는다', async () => {
    installChrome(fullSync());
    document.body.innerHTML =
      '<form><div><label for="z">우편번호</label><input id="z"></div></form>';

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#z')).toBe('06236');
  });
});

describe('학력·경력·자격증 입력', () => {
  it('학교·전공·학점·졸업년월을 채운다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = `
      <form>
        <div><label for="s">학교명</label><input id="s"></div>
        <div><label for="m">전공</label><input id="m"></div>
        <div><label for="g">학점</label><input id="g"></div>
        <div><label for="gd">졸업년월</label><input id="gd"></div>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#s')).toBe('한국대학교');
    expect(value('#m')).toBe('컴퓨터공학');
    expect(value('#g')).toBe('3.85');
    expect(value('#gd')).toBe('2018-02');
  });

  it('회사·직무·입사년월을 채운다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = `
      <form>
        <div><label for="c">회사명</label><input id="c"></div>
        <div><label for="j">직무</label><input id="j"></div>
        <div><label for="d">입사년월</label><input id="d"></div>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#c')).toBe('로지소프트');
    expect(value('#j')).toBe('백엔드 개발');
    expect(value('#d')).toBe('2020-01');
  });

  it('자격증명과 발급기관을 구분해 채운다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = `
      <form>
        <div><label for="n">자격증명</label><input id="n"></div>
        <div><label for="i">발급기관</label><input id="i"></div>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#n')).toBe('정보처리기사');
    expect(value('#i')).toBe('한국산업인력공단');
  });

  it('회사명 칸에 학교명을 넣지 않는다 — 되돌릴 수 없는 오입력이다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = `
      <form>
        <div><label for="s">학교명</label><input id="s"></div>
        <div><label for="c">회사명</label><input id="c"></div>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#s')).toBe('한국대학교');
    expect(value('#c')).toBe('로지소프트');
  });
});

/**
 * 선택형 필드.
 *
 * 한국 지원서의 학력구분·졸업상태·성별·병역은 대부분 select와 radio다.
 * 예전에는 querySelectorAll('input, textarea')만 훑어 select를 아예 보지 않았고,
 * SKIP_TYPES가 radio를 막았다. 20칸짜리 지원서에서 4칸만 차던 이유다.
 */
const selected = (selector: string) => {
  const el = document.querySelector<HTMLSelectElement>(selector);
  return el ? el.options[el.selectedIndex]?.textContent ?? null : null;
};

describe('select 입력', () => {
  it('저장된 코드(BACHELOR)를 화면의 한국어 보기와 맞춘다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = `
      <form>
        <label for="d">최종학력</label>
        <select id="d">
          <option value="">선택하세요</option>
          <option value="HS">고등학교 졸업</option>
          <option value="BA">대학교(4년)</option>
          <option value="MA">대학원(석사)</option>
        </select>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(selected('#d')).toBe('대학교(4년)');
  });

  it('졸업과 졸업예정을 혼동하지 않는다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = `
      <form>
        <label for="s">졸업구분</label>
        <select id="s">
          <option value="">선택</option>
          <option value="1">재학</option>
          <option value="2">졸업예정</option>
          <option value="3">졸업</option>
        </select>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    // GRADUATED인데 '졸업예정'을 고르면 거짓이 된다
    expect(selected('#s')).toBe('졸업');
  });

  it('졸업예정 학력은 졸업예정을 고른다', async () => {
    installChrome(
      fullSync({ syncedEducation: [{ ...EDUCATION[0], status: 'EXPECTED' }] }),
    );
    document.body.innerHTML = `
      <form>
        <label for="s">졸업구분</label>
        <select id="s">
          <option value="">선택</option>
          <option value="2">졸업예정</option>
          <option value="3">졸업</option>
        </select>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(selected('#s')).toBe('졸업예정');
  });

  it('맞는 보기가 없으면 고르지 않는다 — 틀린 학력보다 빈 칸이 낫다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = `
      <form>
        <label for="d">최종학력</label>
        <select id="d">
          <option value="">선택하세요</option>
          <option value="x">해당 없음</option>
          <option value="y">기타</option>
        </select>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(document.querySelector<HTMLSelectElement>('#d')?.value).toBe('');
  });

  it('이미 골라진 select는 덮어쓰지 않는다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = `
      <form>
        <label for="d">최종학력</label>
        <select id="d">
          <option value="BA">대학교(4년)</option>
          <option value="MA" selected>대학원(석사)</option>
        </select>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(selected('#d')).toBe('대학원(석사)');
  });
});

describe('radio 입력', () => {
  const checkedLabel = (name: string) => {
    const el = document.querySelector<HTMLInputElement>(
      `input[name="${name}"]:checked`,
    );
    return el ? el.value : null;
  };

  it('fieldset의 질문을 읽어 알맞은 보기를 고른다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = `
      <form>
        <fieldset>
          <legend>최종학력</legend>
          <label><input type="radio" name="edu" value="고등학교"> 고등학교</label>
          <label><input type="radio" name="edu" value="대학교"> 대학교</label>
          <label><input type="radio" name="edu" value="대학원"> 대학원</label>
        </fieldset>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(checkedLabel('edu')).toBe('대학교');
  });

  it('이미 선택된 그룹은 건드리지 않는다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = `
      <form>
        <fieldset>
          <legend>최종학력</legend>
          <label><input type="radio" name="edu" value="대학교"> 대학교</label>
          <label><input type="radio" name="edu" value="대학원" checked> 대학원</label>
        </fieldset>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(checkedLabel('edu')).toBe('대학원');
  });

  it('질문을 알 수 없는 그룹은 고르지 않는다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = `
      <form>
        <fieldset>
          <legend>수신 동의</legend>
          <label><input type="radio" name="agree" value="동의"> 동의</label>
          <label><input type="radio" name="agree" value="거부"> 거부</label>
        </fieldset>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(checkedLabel('agree')).toBeNull();
  });
});

/**
 * 값 형식 정규화.
 *
 * 서버는 전화번호를 숫자만으로 저장하는데 지원서는 대부분 하이픈을 요구하거나
 * 입력 중 자동으로 붙인다. 형식이 어긋나면 유효성 검사에서 반려되거나,
 * 마스킹으로 값이 달라져 확장이 "채우지 못했다"고 잘못 보고한다.
 */
describe('값 형식 맞추기', () => {
  it('하이픈을 요구하는 칸에는 하이픈을 넣는다', async () => {
    installChrome(fullSync());
    document.body.innerHTML =
      '<form><label for="p">연락처</label><input id="p" placeholder="010-0000-0000"></form>';

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#p')).toBe('010-1234-5678');
  });

  it('힌트가 없으면 숫자만 넣는다', async () => {
    installChrome(fullSync());
    document.body.innerHTML =
      '<form><label for="p">연락처</label><input id="p"></form>';

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#p')).toBe('01012345678');
  });

  it('구분자 없이 8자리로 받는 생년월일 칸', async () => {
    installChrome(fullSync());
    document.body.innerHTML =
      '<form><label for="b">생년월일</label><input id="b" maxlength="8" placeholder="19950302"></form>';

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#b')).toBe('19950302');
  });

  it('점으로 구분하는 칸', async () => {
    installChrome(fullSync());
    document.body.innerHTML =
      '<form><label for="b">생년월일</label><input id="b" placeholder="YYYY.MM.DD"></form>';

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#b')).toBe('1995.03.02');
  });

  it('마스킹이 값을 바꿔도 채운 것으로 센다', async () => {
    installChrome(fullSync());
    document.body.innerHTML =
      '<form><label for="p">연락처</label><input id="p"></form>';

    await loadContentScript();

    // 입력 즉시 하이픈을 붙이는 사이트를 흉내낸다
    const input = document.getElementById('p') as HTMLInputElement;
    input.addEventListener('input', () => {
      const d = input.value.replace(/[^0-9]/g, '');
      if (d.length === 11) {
        input.value = `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
      }
    });

    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#p')).toBe('010-1234-5678');
    // 예전에는 문자열이 달라졌다는 이유로 실패로 세어 '찾지 못했습니다'를 띄웠다
    expect(toastText()).toContain('전화번호 1');
  });
});

/**
 * 입력 전 확인.
 *
 * 확장은 모든 사이트에 주입되고 버튼 한 번에 27개 규칙이 돈다.
 * LONG_TEXT_HINT는 '자기소개'만 걸리면 매칭되므로, 커뮤니티 가입 폼의
 * '자기소개' 칸에도 지원용 자소서 전문이 들어갈 수 있다.
 * 넣기 전에 무엇이 어디로 가는지 보여주고 확인을 받아야 한다.
 */
describe('입력 전 확인', () => {
  const FORM = `
    <form>
      <div><label for="n">이름</label><input id="n"></div>
      <div><label for="e">이메일</label><input id="e" type="email"></div>
      <div><label for="q">지원 동기</label><textarea id="q"></textarea></div>
    </form>`;

  it('바로 채우지 않고 패널을 먼저 띄운다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = FORM;

    await loadContentScript();
    const panel = openPanel();
    await new Promise((r) => setTimeout(r, 20));

    expect(panel).not.toBeNull();
    // 확인 전에는 한 글자도 들어가면 안 된다
    expect(value('#n')).toBe('');
    expect(value('#e')).toBe('');
    expect(value('#q')).toBe('');
  });

  it('어느 사이트에 무엇이 들어가는지 보여준다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = FORM;

    await loadContentScript();
    const panel = openPanel();

    expect(panel?.textContent).toContain('jobs.example.com');
    expect(panel?.textContent).toContain('홍길동');
    expect(panel?.textContent).toContain('이름');
  });

  it('확인을 눌러야 채워진다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = FORM;

    await loadContentScript();
    openPanel();
    confirmPanel();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#n')).toBe(PROFILE.name);
  });

  it('취소하면 아무 일도 일어나지 않는다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = FORM;

    await loadContentScript();
    openPanel();
    document
      .querySelector<HTMLElement>('.autofill-fit-panel__cancel')
      ?.click();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#n')).toBe('');
    expect(document.querySelector('.autofill-fit-panel')).toBeNull();
  });

  it('자소서는 기본 해제다 — 길고 되돌리기 어렵다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = FORM;

    await loadContentScript();
    openPanel();
    // 켜진 것만 그대로 두고 확인
    confirmPanel(false);
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#n')).toBe(PROFILE.name);
    expect(value('#e')).toBe(PROFILE.email);
    expect(value('#q')).toBe('');
  });

  it('끈 항목은 넣지 않는다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = FORM;

    await loadContentScript();
    const panel = openPanel();

    // 첫 항목(이름)을 끈다
    const boxes = panel!.querySelectorAll<HTMLInputElement>(
      '.autofill-fit-row input[type="checkbox"]',
    );
    boxes[0].click();
    panel!.querySelector<HTMLElement>('.autofill-fit-panel__confirm')?.click();
    await new Promise((r) => setTimeout(r, 20));

    expect(value('#n')).toBe('');
    expect(value('#e')).toBe(PROFILE.email);
  });

  it('전부 끄면 확인 버튼이 비활성이다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = FORM;

    await loadContentScript();
    const panel = openPanel();

    panel!
      .querySelectorAll<HTMLInputElement>('.autofill-fit-row input[type="checkbox"]')
      .forEach((box) => {
        if (box.checked) box.click();
      });

    const confirm = panel!.querySelector<HTMLButtonElement>(
      '.autofill-fit-panel__confirm',
    );
    expect(confirm?.disabled).toBe(true);
  });

  it('허용한 사이트에서는 묻지 않는다', async () => {
    installChrome({ ...fullSync(), allowedHosts: ['jobs.example.com'] });
    document.body.innerHTML = FORM;

    await loadContentScript();
    openPanel();
    await new Promise((r) => setTimeout(r, 20));

    expect(document.querySelector('.autofill-fit-panel')).toBeNull();
    expect(value('#n')).toBe(PROFILE.name);
    // 묻지 않아도 자소서는 여전히 기본 해제다
    expect(value('#q')).toBe('');
  });

  it('"다음부터 묻지 않기"를 선택하면 저장한다', async () => {
    const local: Record<string, unknown> = fullSync();
    installChrome(local);
    document.body.innerHTML = FORM;

    await loadContentScript();
    const panel = openPanel();
    panel!
      .querySelector<HTMLInputElement>('.autofill-fit-panel__remember input')!
      .click();
    panel!.querySelector<HTMLElement>('.autofill-fit-panel__confirm')?.click();
    await new Promise((r) => setTimeout(r, 20));

    expect(local.allowedHosts).toEqual(['jobs.example.com']);
  });
});

describe('되돌리기', () => {
  const FORM = `
    <form>
      <div><label for="n">이름</label><input id="n"></div>
      <div><label for="e">이메일</label><input id="e" type="email"></div>
    </form>`;

  it('채운 뒤 되돌리기 버튼이 나온다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = FORM;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(document.querySelector('.autofill-fit-undo')).not.toBeNull();
  });

  it('누르면 채우기 전 값으로 돌아간다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = FORM;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));
    expect(value('#n')).toBe(PROFILE.name);

    document.querySelector<HTMLElement>('.autofill-fit-undo')?.click();
    await new Promise((r) => setTimeout(r, 20));

    // 손으로 지우지 않아도 복구된다
    expect(value('#n')).toBe('');
    expect(value('#e')).toBe('');
    expect(toastText()).toContain('되돌렸습니다');
  });

  it('선택형 칸도 되돌린다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = `
      <form>
        <label for="d">최종학력</label>
        <select id="d">
          <option value="">선택하세요</option>
          <option value="BA">대학교(4년)</option>
        </select>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelector<HTMLSelectElement>('#d')?.value).toBe('BA');

    document.querySelector<HTMLElement>('.autofill-fit-undo')?.click();
    await new Promise((r) => setTimeout(r, 20));

    expect(document.querySelector<HTMLSelectElement>('#d')?.value).toBe('');
  });

  it('채운 것이 없으면 되돌리기를 띄우지 않는다', async () => {
    installChrome(fullSync());
    // 장문 칸이 하나뿐이면 fallback이 적용되므로 두 개를 둔다
    document.body.innerHTML = `
      <form>
        <div><label for="x">배송 요청사항</label><textarea id="x"></textarea></div>
        <div><label for="y">문의 내용</label><textarea id="y"></textarea></div>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(document.querySelector('.autofill-fit-undo')).toBeNull();
  });
});

describe('확인 패널의 라디오 표기', () => {
  it('보기가 아니라 질문을 라벨로 쓴다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = `
      <form>
        <fieldset>
          <legend>최종학력 구분</legend>
          <label><input type="radio" name="edu" value="고등학교"> 고등학교</label>
          <label><input type="radio" name="edu" value="대학교"> 대학교</label>
        </fieldset>
      </form>`;

    await loadContentScript();
    const panel = openPanel();

    const row = panel!.querySelector('.autofill-fit-row');
    // 예전에는 "대학교 → 대학교"로 나와 무엇을 고른 건지 알 수 없었다
    expect(row?.querySelector('.autofill-fit-row__label')?.textContent).toBe(
      '최종학력 구분',
    );
    expect(row?.querySelector('.autofill-fit-row__value')?.textContent).toBe(
      '대학교',
    );
  });
});

/**
 * 이력서 기준 시각.
 *
 * 확장은 "언제 전달받았는지"는 알지만 "그 이력서를 언제 썼는지"는 몰랐다.
 * 두 달 전 경력으로 지원서를 내면서도 어제 전달했으면 최신처럼 보인다.
 */
describe('이력서 신선도', () => {
  const FORM = '<form><div><label for="n">이름</label><input id="n"></div></form>';
  const daysAgo = (n: number) =>
    new Date(Date.now() - n * 86400000).toISOString();

  it('확인 패널에 저장 시각을 보여준다', async () => {
    installChrome({ ...fullSync(), resumeUpdatedAt: daysAgo(3) });
    document.body.innerHTML = FORM;

    await loadContentScript();
    const panel = openPanel();

    expect(panel?.textContent).toContain('3일 전');
  });

  it('오래된 이력서는 경고로 표시한다', async () => {
    installChrome({ ...fullSync(), resumeUpdatedAt: daysAgo(60) });
    document.body.innerHTML = FORM;

    await loadContentScript();
    const panel = openPanel();

    const note = panel?.querySelector('.autofill-fit-panel__freshness');
    expect(note?.className).toContain('is-stale');
    expect(note?.textContent).toContain('최신인지 확인');
  });

  it('최근 이력서는 경고하지 않는다', async () => {
    installChrome({ ...fullSync(), resumeUpdatedAt: daysAgo(2) });
    document.body.innerHTML = FORM;

    await loadContentScript();
    const panel = openPanel();

    expect(
      panel?.querySelector('.autofill-fit-panel__freshness')?.className,
    ).not.toContain('is-stale');
  });

  it('저장 시각을 모르면 전달 시각으로 대신한다', async () => {
    installChrome({ ...fullSync(), syncedAt: daysAgo(5) });
    document.body.innerHTML = FORM;

    await loadContentScript();
    const panel = openPanel();

    expect(panel?.textContent).toContain('5일 전');
  });
});

/**
 * 제출 전 빈칸 점검.
 *
 * 확장이 20칸을 채우면 사용자는 다 됐다고 믿는다. 그런데 증명사진과
 * 동의 체크박스는 여전히 비어 있고, 그대로 제출하면 반려된다.
 */
describe('남은 필수 칸', () => {
  it('확장이 채우지 못한 필수 칸을 센다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = `
      <form>
        <div><label for="n">이름</label><input id="n" required></div>
        <div><label for="p">증명사진</label><input id="p" type="file" required></div>
        <div><label for="a">개인정보 동의</label><input id="a" type="checkbox" required></div>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    const bar = document.querySelector('.autofill-fit-remaining');
    expect(bar?.textContent).toContain('2개');
    // 파일 칸은 확장이 영원히 채울 수 없으므로 따로 알려 준다
    expect(bar?.textContent).toContain('첨부 1개');
  });

  it('확장이 채운 필수 칸은 세지 않는다', async () => {
    installChrome(fullSync());
    document.body.innerHTML =
      '<form><div><label for="n">이름</label><input id="n" required></div></form>';

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(document.querySelector('.autofill-fit-remaining')).toBeNull();
  });

  it('라디오 그룹은 한 번만 센다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = `
      <form>
        <div><label for="n">이름</label><input id="n" required></div>
        <fieldset>
          <legend>수신 동의</legend>
          <label><input type="radio" name="ok" value="y" required> 동의</label>
          <label><input type="radio" name="ok" value="n" required> 거부</label>
        </fieldset>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    // 2개가 아니라 1개다
    expect(document.querySelector('.autofill-fit-remaining')?.textContent).toContain(
      '1개',
    );
  });

  it('필수가 아닌 빈 칸은 세지 않는다', async () => {
    installChrome(fullSync());
    document.body.innerHTML = `
      <form>
        <div><label for="n">이름</label><input id="n" required></div>
        <div><label for="m">기타 메모</label><input id="m"></div>
      </form>`;

    await loadContentScript();
    clickAutofill();
    await new Promise((r) => setTimeout(r, 20));

    expect(document.querySelector('.autofill-fit-remaining')).toBeNull();
  });
});
