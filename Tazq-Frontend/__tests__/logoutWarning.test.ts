import fs from 'fs';
import path from 'path';

/**
 * ÇIKIŞ UYARISI — kullanıcı neyi kaybettiğini bilerek onaylamalı.
 *
 * ── DURUM ───────────────────────────────────────────────────────────────────────
 * Çıkış yapmak `clearLocalUserData()` çağırıyor ve cihazdaki her şeyi siliyor. Verilerin
 * bir kısmı sunucudan geri geliyor (görevler, planlar, tercihler, başarımlar) ama bir kısmı
 * YALNIZ cihazda tutuluyor ve hiçbir yerden geri gelmiyor:
 *
 *   · alışkanlıklar ve tüm tamamlama geçmişi (seriler dahil) — sunucuda tablo YOK
 *   · kilo geçmişi        · bırakma kaydı (başlangıç + nüksler)
 *   · bütçe kayıtları     · konu/müfredat ilerlemesi
 *
 * Onay penceresi ise yalnızca "emin misiniz?" diyordu. Kullanıcı geri alınamaz bir silme
 * işlemini, sildiğini bilmeden onaylıyordu — üstelik uygulamanın en değerli verisini
 * (aylarca sürdürülmüş seriler) kaybediyordu.
 *
 * ── NEDEN "DÜZELTME" BU ─────────────────────────────────────────────────────────
 * Doğru çözüm alışkanlıkları sunucuya taşımak; o bir ÖZELLİK ve şifreleme tasarımı
 * gerektiriyor (görevler AES-GCM ile şifreli saklanıyor, tercih JSON'u değil). Yayın
 * öncesi aceleyle yapılacak iş değil. Bu arada yapılabilecek en dürüst şey, kullanıcıyı
 * kararı vermeden önce bilgilendirmek ve yedek almaya yönlendirmek.
 */
const I18N = fs.readFileSync(
  path.resolve(__dirname, '../shared/constants/i18n.ts'),
  'utf8',
);

const messages = [...I18N.matchAll(/confirmLogout: '([^']*)'/g)].map((m) => m[1]);

describe('çıkış onayı bilgilendirici', () => {
  it('her iki dilde de tanımlı', () => {
    expect(messages.length).toBe(2);
  });

  it('geri gelmeyen verileri tek tek sayıyor', () => {
    const [en, tr] = messages;
    for (const word of ['habits', 'weight', 'quit', 'budget']) {
      expect(en.toLowerCase()).toContain(word);
    }
    for (const word of ['alışkanlık', 'kilo', 'bırakma', 'bütçe']) {
      expect(tr.toLowerCase()).toContain(word);
    }
  });

  it('geri GELENLERİ de söylüyor — gereksiz korku yaratmasın', () => {
    // Yalnız kaybı anlatmak kullanıcıyı "hiçbir şey kalmayacak" sanısına iter.
    // Ayrım net olmalı: hesapta duran ile cihazda duran.
    const [en, tr] = messages;
    expect(en.toLowerCase()).toContain('tasks');
    expect(tr.toLowerCase()).toContain('görev');
  });

  it('kalıcılığı açıkça belirtiyor', () => {
    const [en, tr] = messages;
    expect(en.toLowerCase()).toMatch(/for good|permanent|cannot|erase/);
    expect(tr.toLowerCase()).toMatch(/geri alınamaz|kalıcı/);
  });

  it('yedek alma yolunu gösteriyor', () => {
    // Uyarı tek başına yetmez; kullanıcıya çıkış yolu da sunulmalı.
    const [en, tr] = messages;
    expect(en.toLowerCase()).toContain('export');
    expect(tr.toLowerCase()).toContain('indir');
  });

  it('satır sonları gerçek kaçış dizisi — Alert tek blok metin göstermesin', () => {
    // Metin uzun; paragraf ayrımı olmadan okunmaz bir duvara dönüşür.
    for (const m of messages) expect(m).toContain('\\n\\n');
  });
});
