/**
 * @file Tes unit pembatas percobaan masuk dengan jam palsu.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOGIN_RATE_MAX,
  LOGIN_RATE_WINDOW_MS,
  LoginRateLimiter,
  buildLoginRateKey,
  readLoginRateLimitMax,
} from '@/lib/login-rate-limiter';

/**
 * Membuat jam palsu yang bisa dimajukan.
 *
 * @returns Fungsi pembaca waktu dan fungsi untuk memajukannya.
 */
function jamPalsu() {
  let sekarang = 1_000_000;
  return {
    now: () => sekarang,
    maju: (ms: number) => {
      sekarang += ms;
    },
  };
}

describe('LoginRateLimiter', () => {
  it('mengizinkan sampai batas lalu menolak percobaan berikutnya', () => {
    const jam = jamPalsu();
    const pembatas = new LoginRateLimiter({ maxAttempts: 3, now: jam.now });

    expect(pembatas.tryConsume('a@x.test')).toBe(true);
    expect(pembatas.tryConsume('a@x.test')).toBe(true);
    expect(pembatas.tryConsume('a@x.test')).toBe(true);
    expect(pembatas.tryConsume('a@x.test')).toBe(false);
    expect(pembatas.tryConsume('a@x.test')).toBe(false);
  });

  it('menghitung tiap kunci sendiri-sendiri', () => {
    const jam = jamPalsu();
    const pembatas = new LoginRateLimiter({ maxAttempts: 1, now: jam.now });

    expect(pembatas.tryConsume('a@x.test|1.1.1.1')).toBe(true);
    expect(pembatas.tryConsume('a@x.test|1.1.1.1')).toBe(false);
    expect(pembatas.tryConsume('a@x.test|2.2.2.2')).toBe(true);
    expect(pembatas.tryConsume('b@x.test')).toBe(true);
  });

  it('mulai dari nol setelah jendela 15 menit berakhir', () => {
    const jam = jamPalsu();
    const pembatas = new LoginRateLimiter({ maxAttempts: 2, now: jam.now });
    pembatas.tryConsume('k');
    pembatas.tryConsume('k');
    expect(pembatas.tryConsume('k')).toBe(false);

    jam.maju(LOGIN_RATE_WINDOW_MS - 1);
    expect(pembatas.tryConsume('k')).toBe(false);

    jam.maju(1);
    expect(pembatas.tryConsume('k')).toBe(true);
  });

  it('percobaan yang ditolak tidak memperpanjang jendela', () => {
    const jam = jamPalsu();
    const pembatas = new LoginRateLimiter({ maxAttempts: 1, now: jam.now });
    pembatas.tryConsume('k');

    jam.maju(LOGIN_RATE_WINDOW_MS - 1000);
    expect(pembatas.tryConsume('k')).toBe(false);
    jam.maju(1000);
    expect(pembatas.tryConsume('k')).toBe(true);
  });

  it('reset menghapus hitungan sebuah kunci', () => {
    const jam = jamPalsu();
    const pembatas = new LoginRateLimiter({ maxAttempts: 1, now: jam.now });
    pembatas.tryConsume('k');
    expect(pembatas.tryConsume('k')).toBe(false);

    pembatas.reset('k');
    expect(pembatas.tryConsume('k')).toBe(true);
  });

  it('memakai batas bawaan 10 dan jendela 15 menit', () => {
    const jam = jamPalsu();
    const pembatas = new LoginRateLimiter({ now: jam.now });
    for (let i = 0; i < DEFAULT_LOGIN_RATE_MAX; i += 1) {
      expect(pembatas.tryConsume('k')).toBe(true);
    }
    expect(pembatas.tryConsume('k')).toBe(false);
    expect(LOGIN_RATE_WINDOW_MS).toBe(15 * 60 * 1000);
  });
});

describe('buildLoginRateKey', () => {
  it('menggabungkan email yang dirapikan dengan IP bila ada', () => {
    expect(buildLoginRateKey('  Admin@Garasi.TEST ', '10.0.0.1')).toBe('admin@garasi.test|10.0.0.1');
  });

  it('memakai email saja bila IP tidak diketahui', () => {
    expect(buildLoginRateKey('a@x.test')).toBe('a@x.test');
    expect(buildLoginRateKey('a@x.test', null)).toBe('a@x.test');
    expect(buildLoginRateKey('a@x.test', '  ')).toBe('a@x.test');
  });
});

describe('readLoginRateLimitMax', () => {
  it('membaca bilangan bulat positif dari AUTH_RATE_LIMIT_MAX', () => {
    expect(readLoginRateLimitMax({ AUTH_RATE_LIMIT_MAX: '5' })).toBe(5);
    expect(readLoginRateLimitMax({ AUTH_RATE_LIMIT_MAX: ' 25 ' })).toBe(25);
  });

  it('memakai 10 bila kosong atau tidak sah', () => {
    for (const nilai of [undefined, '', 'abc', '0', '-3', '1.5', '1e2', '0x5', '9999999']) {
      expect(readLoginRateLimitMax({ AUTH_RATE_LIMIT_MAX: nilai })).toBe(10);
    }
    expect(readLoginRateLimitMax({})).toBe(10);
  });
});
