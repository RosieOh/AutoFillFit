import {
  maskAddress,
  maskBirthdate,
  maskEmail,
  maskName,
  maskPhone,
  maskZipCode,
} from './mask.util';

/**
 * 마스킹이 약해지는 회귀는 조용히 일어난다(테스트가 없으면 아무도 모른다).
 * 각 함수가 "무엇을 남기는지"와 "무엇을 반드시 가리는지"를 함께 고정한다.
 */
describe('mask.util', () => {
  describe('maskEmail', () => {
    it('앞 2글자와 도메인만 남긴다', () => {
      expect(maskEmail('hong@example.com')).toBe('ho**@example.com');
    });

    it('로컬파트가 길어도 원문이 드러나지 않는다', () => {
      const masked = maskEmail('verylongaddress@example.com');
      expect(masked).toContain('@example.com');
      expect(masked).not.toContain('verylongaddress');
    });

    it('null은 그대로 통과', () => {
      expect(maskEmail(null)).toBeNull();
    });

    it('@가 없으면 통째로 가린다', () => {
      expect(maskEmail('broken')).toBe('***');
    });
  });

  describe('maskName', () => {
    it('세 글자 이름은 가운데를 가린다', () => {
      expect(maskName('홍길동')).toBe('홍*동');
    });

    it('두 글자 이름은 뒤를 가린다', () => {
      expect(maskName('김철')).toBe('김*');
    });

    it('한 글자는 그대로 (가릴 것이 없다)', () => {
      expect(maskName('김')).toBe('김');
    });

    it('긴 이름도 첫 글자와 끝 글자만 남는다', () => {
      expect(maskName('John Doe')).toBe('J******e');
    });
  });

  describe('maskPhone', () => {
    it('앞 3자리와 뒤 4자리만 남긴다', () => {
      expect(maskPhone('01012345678')).toBe('010-****-5678');
    });

    it('하이픈이 있어도 같은 결과', () => {
      expect(maskPhone('010-1234-5678')).toBe('010-****-5678');
    });

    it('가운데 4자리는 절대 남지 않는다', () => {
      expect(maskPhone('01098765432')).not.toContain('9876');
    });
  });

  it('maskBirthdate는 연도만 남긴다 — 나이대는 알되 생일은 가린다', () => {
    expect(maskBirthdate('1995-03-02')).toBe('1995-**-**');
  });

  describe('maskAddress', () => {
    it('앞 두 어절만 남긴다', () => {
      expect(maskAddress('서울시 강남구 테헤란로 123')).toBe('서울시 강남구 ***');
    });

    it('상세 주소는 남지 않는다', () => {
      expect(maskAddress('서울시 강남구 테헤란로 123 로지타워 4층')).not.toContain(
        '로지타워',
      );
    });
  });

  it('maskZipCode는 앞 2자리만 남긴다', () => {
    expect(maskZipCode('06236')).toBe('06***');
  });

  it('빈 값은 모두 그대로 통과한다', () => {
    expect(maskName(null)).toBeNull();
    expect(maskPhone(null)).toBeNull();
    expect(maskAddress(null)).toBeNull();
    expect(maskZipCode(null)).toBeNull();
    expect(maskBirthdate(null)).toBeNull();
  });
});
