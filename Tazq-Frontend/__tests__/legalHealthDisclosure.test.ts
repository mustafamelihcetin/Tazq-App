import fs from 'fs';
import path from 'path';

const FRONTEND = path.resolve(__dirname, '..');
const WEB_POLICY = path.resolve(FRONTEND, '../Tazq-Backend/wwwroot/gizlilik.html');
const APP_POLICY = path.resolve(FRONTEND, 'shared/constants/legal.ts');
const APP_JSON = path.resolve(FRONTEND, 'app.json');

/**
 * SAĞLIK VERİSİ BEYANI — okunan her veri sözleşmede YAZILI olmalı.
 *
 * Gizlilik metni İKİ AYRI YERDE duruyor: web sitesindeki `gizlilik.html` ve uygulama
 * içindeki `legal.ts`. İkisi elle güncelleniyor, yani birini değiştirip ötekini unutmak
 * an meselesi. Bu yalnızca bir tutarsızlık değil — App Store ve Google Play, okunan
 * sağlık verisinin gizlilik politikasında AÇIKÇA sayılmasını şart koşuyor. Eksik beyan,
 * yayından kaldırılma sebebi.
 *
 * Asıl korunan şey şu senaryo: biri yeni bir sağlık izni ekler (nabız, kalori, su),
 * özellik çalışır, testler geçer, uygulama yayına gider — ve okunan veri hiçbir
 * sözleşmede yazmıyordur. Bu test o yolu kapatıyor: izin listesi ile beyan metni
 * birbirine bağlı, biri diğeri olmadan büyüyemez.
 */

const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('sağlık verisi beyanı — izinler ve sözleşme birlikte hareket eder', () => {
  const web = read(WEB_POLICY);
  const app = read(APP_POLICY);
  const config = JSON.parse(read(APP_JSON));

  /** Android izni → sözleşmede geçmesi gereken TR ve EN ifadeler. */
  const DISCLOSURE: Record<string, { tr: RegExp; en: RegExp }> = {
    'android.permission.health.READ_SLEEP': { tr: /uyku süreniz/i, en: /sleep duration/i },
    'android.permission.health.READ_STEPS': { tr: /adım sayınız/i, en: /step count/i },
    'android.permission.health.READ_DISTANCE': { tr: /mesafeniz/i, en: /distance/i },
    'android.permission.health.READ_EXERCISE': { tr: /antrenman seanslarınız/i, en: /workout sessions/i },
  };

  const healthPermissions: string[] = (config.expo.android.permissions ?? []).filter((p: string) =>
    p.startsWith('android.permission.health.'),
  );

  it('okunan her sağlık izni için bir beyan tanımı var', () => {
    // Yeni bir izin eklendiğinde bu test ilk kırılan olur ve beyan yazmaya zorlar.
    const undeclared = healthPermissions.filter((p) => !DISCLOSURE[p]);
    expect(undeclared).toEqual([]);
  });

  it.each(Object.keys(DISCLOSURE))('%s — web sözleşmesinde TR ve EN olarak beyan edilmiş', (perm) => {
    if (!healthPermissions.includes(perm)) return; // izin kaldırıldıysa beyan şartı da kalkar
    expect(web).toMatch(DISCLOSURE[perm].tr);
    expect(web).toMatch(DISCLOSURE[perm].en);
  });

  it.each(Object.keys(DISCLOSURE))('%s — uygulama içi sözleşmede TR ve EN olarak beyan edilmiş', (perm) => {
    if (!healthPermissions.includes(perm)) return;
    expect(app).toMatch(DISCLOSURE[perm].tr);
    expect(app).toMatch(DISCLOSURE[perm].en);
  });

  it('iOS izin metni okunan verileri somut olarak sayıyor', () => {
    // Apple App Review genel ifadeleri ("health data") reddediyor; ne okunduğu yazmalı.
    const usage: string = config.expo.ios.infoPlist.NSHealthShareUsageDescription;
    expect(usage).toMatch(/sleep/i);
    expect(usage).toMatch(/step/i);
    expect(usage).toMatch(/workout/i);
  });

  it('salt okunur olduğu her iki sözleşmede de yazıyor', () => {
    // Uygulama Sağlık\'a hiçbir şey yazmıyor; kullanıcının bunu bilme hakkı var ve
    // yazma izni istenmediğinin kalıcı kaydı burada.
    expect(web).toMatch(/SALT OKUNUR/);
    expect(web).toMatch(/READ-ONLY/);
    expect(app).toMatch(/SALT OKUNUR/);
    expect(app).toMatch(/READ-ONLY/);
  });

  it('cihazdan çıkmadığı beyanı korunuyor', () => {
    // Bu cümle özelliğin temel vaadi: veri sunucuya gitmiyor. Sessizce kaybolmamalı.
    expect(web).toMatch(/YALNIZCA CİHAZINIZDA/);
    expect(app).toMatch(/YALNIZCA CİHAZINIZDA/);
  });
});
