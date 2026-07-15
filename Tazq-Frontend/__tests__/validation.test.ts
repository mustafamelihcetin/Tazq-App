import { isValidEmail, isValidPassword, validateLogin, validateRegister } from '@/shared/utils/validation';

describe('isValidEmail', () => {
  it('accepts well-formed addresses', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('mustafa.melih@example.com')).toBe(true);
    expect(isValidEmail('  trimmed@mail.com  ')).toBe(true);
  });
  it('rejects malformed addresses', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('no-at-sign')).toBe(false);
    expect(isValidEmail('missing@tld')).toBe(false);
    expect(isValidEmail('two @spaces.com')).toBe(false);
    expect(isValidEmail('a@b.c om')).toBe(false);
  });
});

describe('isValidPassword', () => {
  // Politika (backend PasswordPolicy.IsStrong ile birebir): >=8 karakter + harf + rakam.
  it('requires at least 8 chars', () => {
    expect(isValidPassword('abc1234')).toBe(false);
    expect(isValidPassword('abcd1234')).toBe(true);
  });

  it('requires both a letter and a digit', () => {
    expect(isValidPassword('12345678')).toBe(false); // rakam var, harf yok
    expect(isValidPassword('abcdefgh')).toBe(false); // harf var, rakam yok
    expect(isValidPassword('abcdefg1')).toBe(true);
  });

  it('accepts Turkish letters as letters', () => {
    expect(isValidPassword('şifreçğ1')).toBe(true);
  });

  it('rejects empty input', () => {
    expect(isValidPassword('')).toBe(false);
  });
});

describe('validateLogin', () => {
  it('flags empty then invalid email', () => {
    expect(validateLogin('', '')).toBe('empty');
    expect(validateLogin('bad', 'pw')).toBe('invalidEmail');
    expect(validateLogin('ok@mail.com', 'pw')).toBe(null);
  });
});

describe('validateRegister', () => {
  it('walks the validation chain in order', () => {
    expect(validateRegister('', '', '', false)).toBe('empty');
    expect(validateRegister('Mel', 'bad', 'secret', true)).toBe('invalidEmail');
    expect(validateRegister('Mel', 'ok@mail.com', '123', true)).toBe('weakPassword');
    expect(validateRegister('Mel', 'ok@mail.com', 'abcd1234', false)).toBe('consent');
    expect(validateRegister('Mel', 'ok@mail.com', 'abcd1234', true)).toBe(null);
  });
});
