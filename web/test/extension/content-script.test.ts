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

function clickAutofill() {
  const button = document.querySelector<HTMLElement>('.autofill-fit-btn');
  button?.click();
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
