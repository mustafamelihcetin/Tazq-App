import type { FocusSceneId } from '@/features/focus/utils/focusScenes';

/*
  SAHNE GÖLGELENDİRİCİLERİ. Saf metin; React Native'e bağlı değil, bu yüzden gerçek Skia ile testte derlenir (bkz. __tests__/sceneShaders.test.ts).
  SkSL hatası uygulamada sessizce boş ekran verir; yeni sahne bu testten geçmeden girmez.
*/

// ── Skia nebula ───────────────────────────────────────────────────────────────
// Eski görsel: koyu lacivert taban + 3 yarı-saydam renkli dairenin döndürülüp harmanlanması
// (üst üste katman = overdraw = ısı). Yeni: aynı görünüm tek GPU shader'ı ile, tek draw call,
// overdraw ve maske pass olmadan. Renk merkezleri zamana göre yumuşakça sürüklenir.
export const NEBULA_SKSL = `
uniform float u_time;
uniform float2 u_res;
uniform float3 c1;
uniform float3 c2;
uniform float3 c3;
uniform float3 base0;
uniform float3 base1;
uniform float u_hold;
uniform float u_growth; // seans ilerledikçe dünya değişir: 0 başlangıç, 1 tamam
uniform float u_lights; // toplanan parça sayısı (5 dk'da bir, en çok 12)
uniform float u_born;   // en yeni parçanın doğuş parıltısı
uniform float u_sky;    // 1: yalnız gök (Haftanın Gökyüzü): manzara ve sahnenin parçacıkları yok, görünen her ışık gerçek bir seans

// Sinema dokusu. İLKE (2026-11-05, kullanıcı: "odağı kolaylaştırmalı, hipnoz etmeli, rahatlatmalı"): sahne süs değil, odağın aracı.
// Parıldama, ani olay, yüksek kontrastlı nokta yok; tek yavaş ritim, göz sayacın üstünde dinlenir.
float3 film(float3 col, float2 fc) {
  float2 d = fc / u_res - float2(0.5, 0.5);
  float vig = 1.0 - dot(d, d) * 0.9;
  // Duran gren: zamanla değişirse ekran karıncalanır, göz ona takılır.
  float3 gp = fract(float3(fc.x, fc.y, fc.x) * 0.1031);
  gp += dot(gp, float3(gp.y, gp.z, gp.x) + 33.33);
  float g = fract((gp.x + gp.y) * gp.z) - 0.5;
  // Tüm sahne tek ritimde, nefes hızında kabarıp iner: göz ve nefes buna uyar. Zen'de ~10 sn (dakikada 6 döngü).
  float swell = 0.86 + 0.14 * sin(u_time * 0.97);
  // Yalnız gök: zemin derinleşir, üstündeki kazanılmış yıldızlar öne çıkar.
  return col * vig * swell * (1.0 - u_sky * 0.45) + g * 0.012;
}

float hash1(float n) {
  n = fract(n * 0.1031);
  n *= n + 33.33;
  n *= n + n;
  return fract(n);
}
float noise1(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash1(i), hash1(i + 1.0), f);
}

// Asılı ışık perdesi: gökte çapraz uzanan, sık kıvrımlı alt kenar; yukarı doğru dikey ışınlara ayrılarak söner.
// Renk yükseklikle değişir: altta c1, ortada c2, tepede c3. Kenar yumuşak: keskin olunca dağ silueti gibi okunuyor.
float3 curtain(float2 uv, float t, float edge, float tilt, float seed) {
  // Yatay tuvalde x sıklaşır: ışınlar yayılıp şişmez.
  float wide = max(1.0, u_res.x / u_res.y / 0.8);
  float xw = uv.x * wide;
  float x = xw + 0.05 * sin(xw * 5.0 + t * 0.9 + seed) + 0.02 * sin(xw * 13.0 - t * 1.3 + seed * 2.0);
  float y0 = edge + tilt * (uv.x - 0.5) + 0.018 * sin(x * 11.0 + t * 0.8 + seed) + 0.009 * sin(x * 27.0 - t * 0.6 + seed * 1.7);
  float h = y0 - uv.y;
  // Işınlar: geniş dalga baskın, ince ayrıntı hafif; ince olan baskınsa şeritler keskinleşir.
  float rays = 0.34 + 0.46 * noise1(x * 15.0 - t * 0.35 + seed) + 0.20 * noise1(x * 43.0 + t * 0.9 + seed);
  // Yalnız gök: küçük ve yatay kartta çizgi yok, yalnız akan aydınlık.
  rays = mix(rays, 0.45 + 0.55 * noise1(x * 4.5 - t * 0.2 + seed), u_sky);
  float reach = 0.16 + 0.26 * noise1(x * 9.0 + t * 0.35 + seed * 3.0);
  float up = max(h, 0.0) / reach;
  float3 low = mix(c1, c2, smoothstep(0.0, 1.0, up));
  float green = exp(-up * 1.5) * smoothstep(-0.05 - u_sky * 0.26, 0.03 + u_sky * 0.04, h);
  float violet = smoothstep(0.5, 1.5, up) * exp(-up * 0.55);
  return (low * green * 1.25 + c3 * violet * 0.85) * rays;
}

// Kırıklı sırt: dağın keskin ve düzensiz hattı.
float ridged(float x) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    v += amp * (1.0 - abs(2.0 * noise1(x) - 1.0));
    x = x * 2.1 + 1.7;
    amp *= 0.5;
  }
  return v;
}

half4 main(float2 fragCoord) {
  float2 uv = fragCoord / u_res;
  // Basılı tutma (nefes al): uv'yi merkeze doğru topla → aurora içe çekilir, bırakınca yayılır.
  uv = mix(uv, float2(0.5, 0.5), u_hold * 0.14);
  // Yalnız gök: tuval gökyüzünün kendisine bakar, ufuk ve göl kadraja girmez.
  if (u_sky > 0.5) uv.y *= 0.62;
  float t = u_time * 0.5;

  // Göl: kıyının altı. Ayna sıkıştırılır ki perdenin ışığı da suya düşsün; yalnız dağı yansıtınca aurora gölde görünmüyordu.
  float shore = 0.84;
  float below = step(shore, uv.y);
  float2 q = uv;
  if (below > 0.5) {
    float depth = uv.y - shore;
    q.y = shore - depth * 4.2 + 0.006 * sin(uv.x * 60.0 + t * 1.6);
    q.x += (0.006 + depth * 0.10) * sin(uv.y * 210.0 + t * 2.0);
  }

  // Gece gökyüzü
  float3 col = mix(base0, base1, q.y);

  // Yıldızlar: perdenin arkasında kalır, tek tek kıpırdar.
  float2 g = q * float2(u_res.x / u_res.y, 1.0) * 70.0;
  float2 cell = floor(g);
  float seedS = hash1(cell.x * 57.0 + cell.y * 131.0);
  float2 off = float2(fract(seedS * 7.3), fract(seedS * 13.7)) - 0.5;
  float star = step(0.965 - 0.035 * u_growth, seedS) * smoothstep(0.16, 0.0, length(fract(g) - 0.5 - off * 0.6));
  col += float3(0.82, 0.88, 1.0) * star * (0.42 + 0.12 * sin(u_time * 0.4 + seedS * 40.0)) * (1.0 - u_sky);

  // İki perde: arkadaki soluk ve yüksek, öndeki parlak. Tutunca parlar.
  // OYUN: başta da canlı; odaklandıkça perdeler güçlenir, arka perde açılır.
  float boost = (0.85 + u_hold * 0.75) * (0.62 + 0.38 * u_growth);
  col += curtain(q, t * 0.8, 0.30, -0.10, 4.0) * 0.55 * boost * (0.35 + 0.65 * smoothstep(0.2, 0.8, u_growth)) * (1.0 - u_sky);
  col += curtain(q, t, u_sky > 0.5 ? 0.42 : 0.66, u_sky > 0.5 ? 0.30 : 0.14, 0.0) * boost * (1.0 + u_sky * 0.30);

  // OYUN: her 5 dakikada takımyıldıza bir yıldız eklenir, çizgisi öncekine bağlanır. Soldan sağa gökyüzüne yazılır.
  float H = u_res.y / u_res.x;
  float fit = min(1.0, H / 1.4);
  float2 qa = float2(q.x, q.y * H);
  float2 prevP = float2(0.0, 0.0);
  for (int l = 0; l < 12; l++) {
    float fl = float(l);
    if (fl >= u_lights) break;
    float2 pt = float2(0.07 + 0.075 * fl + 0.03 * hash1(fl * 3.7 + 0.4), (0.07 + 0.34 * hash1(fl * 7.31 + 1.7)) * H);
    float dd = length(qa - pt) / fit;
    float fresh = step(u_lights - 1.0, fl) * u_born;
    col += float3(0.92, 0.96, 1.0) * (smoothstep(0.012, 0.0, dd) + 0.20 * smoothstep(0.06 + fresh * 0.14, 0.0, dd) * (1.0 + fresh * 2.0));
    if (l > 0) {
      float2 pa = qa - prevP;
      float2 ba = pt - prevP;
      float along = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      col += float3(0.70, 0.82, 1.0) * 0.20 * smoothstep(0.0030, 0.0, length(pa - ba * along) / fit);
    }
    prevP = pt;
  }

  // Dağlar: gece dağı çoğunlukla silüettir. Kaya deseni çizilmez (sahte çizgi yapıyordu): üç sıra kırıklı sırt, uzak olan havayla açılır,
  // yalnız tepeler perdenin ışığını yakalar, dipleri vadi pusunda erir.
  if (q.y > 0.50 && u_sky < 0.5) {
    float mx = q.x * max(1.0, u_res.x / u_res.y / 0.8);
    float3 air = mix(base0, c2, 0.07) + c1 * 0.025 * boost;
    float3 mistC = mix(base0, c1, 0.05);
    // En uzak sıra: soluk, neredeyse gökyüzü
    float y3 = shore - 0.05 - 0.24 * ridged(mx * 3.1 + 11.0) - 0.008 * noise1(mx * 41.0);
    float in3 = smoothstep(y3, y3 + 0.0025, q.y);
    float d3 = max(q.y - y3, 0.0);
    col = mix(col, mix(air + c1 * 0.10 * boost * exp(-d3 / 0.008), mistC, smoothstep(0.0, 0.18, d3)), in3 * 0.80);
    // Orta sıra: kar tepede, yamaçta kırık yamalar halinde; yalnız ışığa bakan taraf parlar
    float y2 = shore - 0.03 - 0.17 * ridged(mx * 2.6 + 3.0) - 0.007 * noise1(mx * 53.0);
    float in2 = smoothstep(y2, y2 + 0.002, q.y);
    float d2 = max(q.y - y2, 0.0);
    float slope = ridged(mx * 2.6 + 3.02) - ridged(mx * 2.6 + 2.98);
    float breakup = noise1(mx * 37.0 + d2 * 60.0) * noise1(mx * 19.0 - d2 * 31.0 + 5.0);
    float snow = exp(-d2 / 0.045) * smoothstep(-0.02, 0.05, slope) * smoothstep(0.08, 0.34, breakup);
    float3 rock2 = mix(base0, base1, 0.60) * 0.82;
    float3 lit = c1 * 0.40 + c3 * 0.08 + float3(0.10, 0.13, 0.19);
    float3 tone2 = rock2 + lit * snow * boost + c1 * 0.14 * boost * exp(-d2 / 0.007);
    col = mix(col, mix(tone2, mistC * 0.75, smoothstep(0.03, 0.15, d2) * 0.75), in2);
    // Ön sıra: ağaçlı alçak sırt, tamamen koyu
    float y1 = shore - 0.006 - 0.024 * noise1(mx * 5.0 + 9.0) - 0.012 * noise1(mx * 17.0) - 0.008 * noise1(mx * 95.0);
    col = mix(col, base1 * 0.30, smoothstep(y1, y1 + 0.002, q.y));
  }

  // Su: ayna kararır, derinleştikçe koyulaşır, ince yatay kırışıklar
  if (below > 0.5) {
    float ripple = 0.90 + 0.10 * sin(uv.y * 300.0 + sin(uv.x * 9.0 + t) * 2.0);
    col = mix(col * 0.70 * ripple, base1 * 0.40, smoothstep(shore, 1.05, uv.y) * 0.45);
  }

  return half4(film(col, fragCoord), 1.0);
}
`;


// ── Sahne shader'ları (bkz. features/focus/utils/focusScenes.ts) ─────────────────
// Ortak arayüz: u_time, u_res, c1..c3, base0/base1, u_hold. Teknik referans react-bits
// arka planları; kod SkSL'de yeniden yazıldı. Her biri u_hold'a (nefes tutma) kendi
// biçiminde cevap verir.
const SCENE_HEAD = `
uniform float u_time;
uniform float2 u_res;
uniform float3 c1;
uniform float3 c2;
uniform float3 c3;
uniform float3 base0;
uniform float3 base1;
uniform float u_hold;
uniform float u_growth; // seans ilerledikçe dünya değişir: 0 başlangıç, 1 tamam
uniform float u_lights; // toplanan parça sayısı (5 dk'da bir, en çok 12)
uniform float u_born;   // en yeni parçanın doğuş parıltısı
uniform float u_sky;    // 1: yalnız gök (Haftanın Gökyüzü): manzara ve sahnenin parçacıkları yok, görünen her ışık gerçek bir seans

// Sinema dokusu. İLKE (2026-11-05, kullanıcı: "odağı kolaylaştırmalı, hipnoz etmeli, rahatlatmalı"): sahne süs değil, odağın aracı.
// Parıldama, ani olay, yüksek kontrastlı nokta yok; tek yavaş ritim, göz sayacın üstünde dinlenir.
float3 film(float3 col, float2 fc) {
  float2 d = fc / u_res - float2(0.5, 0.5);
  float vig = 1.0 - dot(d, d) * 0.9;
  // Duran gren: zamanla değişirse ekran karıncalanır, göz ona takılır.
  float3 gp = fract(float3(fc.x, fc.y, fc.x) * 0.1031);
  gp += dot(gp, float3(gp.y, gp.z, gp.x) + 33.33);
  float g = fract((gp.x + gp.y) * gp.z) - 0.5;
  // Tüm sahne tek ritimde, nefes hızında kabarıp iner: göz ve nefes buna uyar. Zen'de ~10 sn (dakikada 6 döngü).
  float swell = 0.86 + 0.14 * sin(u_time * 0.97);
  // Yalnız gök: zemin derinleşir, üstündeki kazanılmış yıldızlar öne çıkar.
  return col * vig * swell * (1.0 - u_sky * 0.45) + g * 0.012;
}
float hash(float2 p) {
  float3 q = fract(float3(p.x, p.y, p.x) * 0.1031);
  q += dot(q, float3(q.y, q.z, q.x) + 33.33);
  return fract((q.x + q.y) * q.z);
}
float vnoise(float2 p) {
  float2 i = floor(p); float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + float2(1.0, 0.0)), u.x),
             mix(hash(i + float2(0.0, 1.0)), hash(i + float2(1.0, 1.0)), u.x), u.y);
}
float fbm(float2 p) {
  float v = 0.0; float a = 0.5;
  for (int k = 0; k < 4; k++) { v += a * vnoise(p); p = p * 2.03 + float2(1.7, 9.2); a *= 0.5; }
  return v;
}
float fbm2(float2 p) { return (vnoise(p) * 0.5 + vnoise(p * 2.03 + float2(1.7, 9.2)) * 0.25) * 1.33; }
`;

// Üç sahne de ÖLÇÜYE DUYARLI (2026-11-05, kullanıcı: "zene geçince odak sayfasındaki kadar kaliteli olmuyor"):
// yuvarlağa göre ayarlıydı, tam ekranda boyca 2 kattan fazla uzuyor ve seyrekleşiyordu. Ayrıntı artık `a` (genişlik birimi)
// ile ölçülür, uzamaz; yerleşim `uv` ile orana göre kalır.
// MANZARA KALİTESİ (kullanıcı: "ağaçlar, dağlar çok ucuz; kaldır demedim, geliştir"): sinüs ve düz koni yok. Kırıklı sırt gürültüsü, ışığı alan doku, uzaklığa göre solma; ön plan sisin ya da suyun içinde erir.

// GELGİT — su altından bakış: yüzey parıltısı, açılan ışık sütunları, kostik vuran kayalar, salınan yosun, kabarcıklar.
// Tutunca ışık derinlere iner.
export const TIDE_SKSL = SCENE_HEAD + `
// Gerçek su kostiği: yinelemeli alan bükme, ince parlak ağ verir (bilinen "tileable water caustic" yöntemi).
float waterCaustic(float2 a, float tm) {
  float2 p = a * 10.0 - 250.0;
  float2 i = p;
  float c = 1.0;
  for (int n = 0; n < 4; n++) {
    float tt = tm * (1.0 - 3.5 / float(n + 1));
    i = p + float2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(float2(p.x / (sin(i.x + tt) / 0.005), p.y / (cos(i.y + tt) / 0.005)));
  }
  c = 1.17 - pow(c / 4.0, 1.4);
  return pow(abs(c), 8.0);
}

half4 main(float2 fragCoord) {
  float2 uv = fragCoord / u_res;
  float2 a = fragCoord / u_res.x;
  float t = u_time * 0.4;
  float3 col = mix(base0, base1, uv.y) + c1 * 0.20 * (1.0 - uv.y) * (1.0 - uv.y);
  // Ufka açılan ışık sütunları
  float fan = (a.x - 0.5) / (a.y + 0.35);
  float rays = vnoise(float2(fan * 9.0 + t * 0.26, t * 0.13));
  rays = rays * rays * (0.6 + 0.8 * vnoise(float2(fan * 23.0 - t * 0.2, 3.0)));
  // OYUN: odaklandıkça ışık daha derine iner.
  float deep = exp(-uv.y * (3.7 - 1.0 * u_growth - u_hold * 1.2));
  col += mix(c3, c1, uv.y) * rays * deep * (1.15 + u_hold * 0.5);
  // Kostik: yüzeye yakın parlak ağ, aşağı indikçe söner
  float caustic = 0.0;
  if (uv.y < 0.42 || uv.y > 0.70) caustic = clamp(waterCaustic(a, t * 0.45), 0.0, 1.0);
  col += c3 * caustic * 0.30 * exp(-uv.y * 6.0);
  // Yüzey: tepede dalgalanan parlak çizgi
  float y0 = 0.035 + 0.010 * sin(a.x * 9.0 + t * 1.4) + 0.006 * sin(a.x * 23.0 - t * 2.0);
  col += c3 * smoothstep(0.075, 0.0, abs(uv.y - y0)) * (0.40 + 0.25 * vnoise(float2(a.x * 14.0, t))) * (1.0 - u_sky);
  // Dip yalnız alt bantta hesaplanır
  float ground = 0.0;
  if (uv.y > 0.58 && u_sky < 0.5) {
  // Dip: uzak kaya suyun rengine karışır (kenarı yumuşak), yosun önünde salınır, yakın kayaya kostik vurur.
  float rockFar = 0.86 - 0.17 * fbm2(float2(a.x * 2.2, 2.0)) - 0.02 * vnoise(float2(a.x * 9.0, 6.0));
  float farIn = smoothstep(rockFar, rockFar + 0.035, uv.y);
  float3 farRock = base1 * 0.9 + mix(base0, c1, 0.10) * 0.35 + c3 * caustic * 0.07;
  col = mix(col, farRock, farIn * 0.92);
  // Yosun: dipte ince, ortada geniş, ucu sivri uzun yaprak; akıntıyla salınır, arkadan ışık alır
  float kx = a.x * 9.0;
  float kid = floor(kx);
  float kh = hash(float2(kid, 4.0));
  float kTall = (0.12 + 0.20 * kh) * (0.55 + 0.45 * u_growth);
  float kBase = 0.94;
  float kUp = clamp((kBase - uv.y) / kTall, 0.0, 1.0);
  float kSway = (0.10 + 0.16 * kh) * kUp * sin(t * 0.6 + kh * 20.0 + kUp * 3.2);
  float kWidth = 0.17 * sin(3.14159 * pow(kUp, 0.5)) + 0.012;
  float kelp = smoothstep(kWidth, kWidth * 0.55, abs(fract(kx) - 0.5 - kSway)) * step(uv.y, kBase) * step(kBase - kTall, uv.y) * step(0.30, kh);
  col = mix(col, mix(base1 * 0.45, c2 * 0.30 + base0 * 0.5, kUp), kelp * 0.9);
  float rockNear = 0.945 - 0.085 * fbm2(float2(a.x * 3.6 + 7.0, 5.0)) - 0.016 * vnoise(float2(a.x * 19.0, 8.0));
  float rockIn = smoothstep(rockNear, rockNear + 0.005, uv.y);
  float grain = fbm2(a * 17.0);
  float lit = exp(-max(uv.y - rockNear, 0.0) / 0.05);
  float3 nearRock = base1 * (0.30 + grain * 0.55) + c3 * lit * (0.05 + caustic * (0.5 + 0.6 * u_growth)) * (0.5 + grain);
  col = mix(col, nearRock, rockIn);
  // OYUN: her 5 dakikada dibe bir inci iner; kalıcı durur, yavaşça parlar.
  float H = u_res.y / u_res.x;
  float fit = min(1.0, H / 1.4);
  for (int l = 0; l < 12; l++) {
    float fl = float(l);
    if (fl >= u_lights) break;
    float2 pc = float2(0.06 + 0.08 * fl + 0.025 * hash(float2(fl, 3.0)), (0.945 + 0.025 * hash(float2(fl, 7.0))) * H);
    float2 toP = (a - pc) / fit;
    float dd = length(toP);
    float rad = 0.015 + 0.004 * hash(float2(fl, 11.0));
    float fresh = step(u_lights - 1.0, fl) * u_born;
    float glowP = 0.75 + 0.25 * sin(u_time * 0.5 + fl * 2.4);
    col += c3 * 0.26 * glowP * smoothstep(0.075 + fresh * 0.14, 0.0, dd) * (1.0 + fresh * 2.0);
    float shade = 0.62 + 0.38 * smoothstep(rad, 0.0, length(toP + float2(rad * 0.3, rad * 0.35)));
    col = mix(col, mix(c3, float3(1.0, 1.0, 1.0), 0.65) * shade * 1.2, smoothstep(rad, rad - 0.003, dd));
  }
  ground = max(rockIn, farIn * 0.6);
  }
  // Kabarcıklar: yükselir, salınır; ince kenar ve küçük parıltı
  float2 sq = fragCoord / min(u_res.x, u_res.y);
  float2 g = float2(sq.x * 7.0, sq.y * 7.0 + t * 0.6);
  float2 id = floor(g);
  float2 f = fract(g) - 0.5;
  float h = hash(id);
  float2 o = float2((h - 0.5) * 0.5 + 0.10 * sin(t * 0.9 + h * 30.0), fract(h * 5.31) - 0.5) * 0.7;
  float rad = 0.05 + 0.08 * fract(h * 3.7);
  float d = length(f - o);
  float body = smoothstep(rad, rad - 0.015, d);
  float rim = smoothstep(rad + 0.012, rad, d) * smoothstep(rad - 0.03, rad, d);
  float gleam = smoothstep(rad * 0.35, 0.0, length(f - o + float2(rad * 0.35, rad * 0.4)));
  col += (c3 * (body * 0.07 + rim * 0.55) + float3(1.0, 1.0, 1.0) * gleam * 0.5) * step(0.90 - 0.06 * u_growth, h) * (1.0 - ground) * 0.7 * (1.0 - u_sky);
  return half4(film(col, fragCoord), 1.0);
}
`;

// KOR — gece şömine başı sıcaklığı (kullanıcı: "cehennem vibe'ı"; kızıl ve mor bırakıldı, amber ve sıcak kahve). Karanlıkta uzaklara uzanan kor tarlası. Sert ufuk çizgisi ve düz taban yok: yakındaki iri kömürler uzakta ince noktalara
// dönüşüp pusta erir (kullanıcı: "altta dümdüz, çok solid"). Isı dalgaları tarlanın üstünden izleyiciye doğru ağır ağır gelir; alt kenar karanlığa iner.
// Tutunca kor ısınır, pus yükselir.
export const EMBER_SKSL = SCENE_HEAD + `
half4 main(float2 fragCoord) {
  float2 uv = fragCoord / u_res;
  float2 a = fragCoord / u_res.x;
  float t = u_time * 0.5;
  float3 deep = c1 * float3(0.70, 0.36, 0.16);
  float3 col = mix(base0, base1, uv.y);
  float horizon = u_sky > 0.5 ? 1.02 : 0.57;
  float gy = uv.y - horizon;
  // Ufuktan yükselen ağır pus; merkezde yoğun, yanlara söner
  float side = 1.0 - smoothstep(0.1, 0.75, abs(a.x - 0.5));
  // Üst yarı boş kalmaz: yukarı kıvrılarak akan sıcak duman. En karanlık anda bile sahne sıcak ve görünür.
  float n = fbm(float2(a.x * 2.0 + t * 0.08, a.y * 1.3 - t * 0.95));
  float smoke = fbm2(float2(a.x * 1.6 + n * 1.4 - t * 0.20, a.y * 1.1 - t * 0.85));
  float beat = 0.80 + 0.20 * sin(u_time * 0.97);
  float warmth = (0.78 + 0.22 * u_growth) * beat;
  float rise = smoothstep(0.05, 0.60, uv.y);
  col += mix(deep, c1, 0.10) * smoothstep(0.26, 0.74, smoke) * (0.20 + rise * 0.55) * warmth;
  float haze = smoothstep(0.42, 0.0, abs(gy - 0.02) + (n - 0.5) * 0.24 - u_hold * 0.08) * (0.65 + side * 0.35) * warmth;
  col += mix(deep, c1, 0.34) * haze * haze * (0.62 + n * 0.85);
  if (gy > 0.0) {
    // Zemin düzlemine izdüşüm: aşağı indikçe yaklaşır
    float z = 0.62 / (gy + 0.03);
    float2 gp = float2((a.x - 0.5) * z * 2.6, z * 2.5);
    // Hücre yok: düzenli ağ neon ızgara gibi duruyordu. Işık organik lekeler ve kopuk damarlar halinde.
    // Alan durmaz: bükme zamanla akar, ışık kömürlerin üstünde sürünerek yer değiştirir.
    float2 warp = float2(fbm2(gp * 0.55 + float2(t * 0.58, 0.0)), fbm2(gp * 0.55 + float2(9.0, t * 0.74)));
    float patch = fbm(gp * 0.62 + warp * 1.4);
    float grain = fbm2(gp * 2.4 + warp);
    // Isı dalgası: düzlemde izleyiciye doğru gelir, bölge bölge uyanır
    float wave = fbm2(float2(gp.x * 0.22 + t * 0.10, gp.y * 0.22 + t * 0.95));
    float live = smoothstep(0.26, 0.62, wave) * (0.55 + side * 0.45) + u_hold * 0.3;
    float field = patch * 0.62 + grain * 0.38;
    // OYUN: tarla soğuk başlar; odaklandıkça ateş ufuktan izleyiciye doğru yürür.
    float ignite = (0.58 + 0.42 * smoothstep(gy - 0.05, gy + 0.05, u_growth * 0.52 - 0.02)) * (0.80 + 0.30 * sin(u_time * 0.97 + patch * 7.0));
    // Yakın alan büyük ve parlak leke olmasın: yaklaştıkça söner
    float close = smoothstep(0.10, 0.30, gy);
    float hot = smoothstep(0.50 - live * 0.13, 0.74, field) * (0.40 + live * 0.85) * (1.0 - close * 0.62) * ignite;
    // Damar: yalnız ısınmış bölgede ince ve kopuk
    float vein = 1.0 - abs(2.0 * fbm2(gp * 1.5 + warp * 2.0) - 1.0);
    vein = smoothstep(0.84, 0.98, vein) * smoothstep(0.34, 0.54, field) * (0.25 + live) * (1.0 - close * 0.5) * ignite;
    float heat = clamp(hot + vein * 0.55, 0.0, 1.2);
    // Kül: koyu, benekli; yanındaki ısıdan hafif kızıl alır
    float3 ash = base0 * (0.40 + grain * 0.60) + deep * 0.05 + float3(0.05, 0.045, 0.04) * smoothstep(0.42, 0.72, grain);
    float3 coal = ash + deep * smoothstep(0.0, 0.55, heat) * 1.25 + c1 * heat * heat * 0.62 + c3 * heat * heat * heat * heat * 0.16;
    // Uzakta pusa erir (ani çizgi yok), en altta karanlığa iner
    float distant = smoothstep(0.0, 0.20, gy);
    col = mix(col, coal, distant);
    col *= 1.0 - smoothstep(0.22, 0.44, gy) * 0.50;
    // OYUN: her 5 dakikada tarlada kalıcı bir sıcak kor yanar; kendi ritminde soluk alır.
    float H = u_res.y / u_res.x;
    for (int l = 0; l < 12; l++) {
      float fl = float(l);
      if (fl >= u_lights) break;
      float gl = 0.05 + 0.21 * hash(float2(fl, 5.0));
      float2 pc = float2(0.07 + 0.076 * fl + 0.03 * hash(float2(fl, 2.0)), (horizon + gl) * H);
      float dd = length((a - pc) * float2(1.0, 2.1)) / min(1.0, H / 1.4);
      float rr = 0.022 + gl * 0.09;
      float fresh = step(u_lights - 1.0, fl) * u_born;
      float pulse = 0.78 + 0.22 * sin(u_time * 0.5 + fl * 1.9);
      float coreL = smoothstep(rr, 0.0, dd) * pulse;
      col += c1 * coreL * coreL * 1.1 + c3 * coreL * coreL * coreL * coreL * 0.6 + deep * smoothstep(rr * (3.0 + fresh * 3.0), 0.0, dd) * (0.45 + fresh);
    }
  }
  // Süzülen ışık zerreleri: odak dışı, iri, yumuşak; ağır ağır yükselir ve yana salınır. Göz takip eder, dikkat dağılmaz.
  float2 sq = fragCoord / min(u_res.x, u_res.y);
  float2 g = float2(sq.x * 3.4, sq.y * 3.4 + t * 0.78);
  float h = hash(floor(g));
  float2 o = float2((h - 0.5) * 0.5 + 0.20 * sin(t * 0.55 + h * 30.0), (fract(h * 7.13) - 0.5) * 0.5);
  float rb = 0.07 + 0.11 * fract(h * 3.3);
  float bokeh = smoothstep(rb, rb * 0.55, length(fract(g) - 0.5 - o));
  float fadeB = smoothstep(0.08, 0.50, uv.y) * (1.0 - smoothstep(0.62, 0.86, uv.y));
  col += mix(c1, c3, 0.25) * bokeh * step(0.74 - 0.12 * u_growth, h) * fadeB * 0.22 * (1.0 - u_sky);
  // Küçük, parlak kıvılcımlar: daha hızlı, seyrek
  float2 g2 = float2(sq.x * 9.0 + 3.1, sq.y * 9.0 + t * 1.6);
  float h2 = hash(floor(g2));
  float2 o2 = float2((h2 - 0.5) * 0.6 + 0.14 * sin(t * 1.3 + h2 * 30.0 + sq.y * 6.0), (fract(h2 * 3.3) - 0.5) * 0.6);
  col += mix(c1, c3, 0.5) * smoothstep(0.05, 0.0, length((fract(g2) - 0.5 - o2) * float2(1.0, 0.6))) * step(0.86 - 0.06 * u_growth, h2) * smoothstep(0.25, 0.62, uv.y) * (1.0 - smoothstep(0.66, 0.9, uv.y)) * 0.75 * (1.0 - u_sky);
  // Filmsel sıkıştırma
  col = col * 1.25 / (1.0 + col * 0.42);
  return half4(film(col, fragCoord), 1.0);
}
`;

// SİS — arkadan yumuşakça aydınlanan çam ormanı: uzak ağaçlar sisle solar, yakınlar kenarından hafif ışık alır,
// tepeler rüzgârda salınır, sis kümeleri farklı hızlarda önlerinden geçer, ateşböcekleri sisi aydınlatır.
// Tutunca sis incelir, ışık öne çıkar.
export const MIST_SKSL = SCENE_HEAD + `
// Bir sıra çam. x: ağaç maskesi, y: kenar şeridi (arka ışık buna vurur).
float2 pines(float2 a, float baseY, float scale, float seed, float soft) {
  // Yatay tuvalde (sahne kartı, seans özeti) ağaçlar küçülür: boyları genişliğe bağlı olduğu için tepeden kesiliyordu.
  scale /= min(1.0, u_res.y / u_res.x / 1.4);
  float cx = a.x * scale + seed;
  float id = floor(cx);
  float h = hash(float2(id, seed));
  float tall = (0.60 + 0.40 * fract(h * 3.7)) * 2.9 / scale;
  float d = (a.y - (baseY - tall)) / tall;
  if (d <= 0.0) return float2(0.0, 0.0);
  // Tepe rüzgârda salınır, dip sabit
  float sway = (1.0 - d) * (1.0 - d) * 0.07 * sin(u_time * 0.32 + h * 20.0 + a.y * scale * 0.6);
  float sx = fract(cx) - 0.5 - (h - 0.5) * 0.4 - sway;
  float side = step(0.0, sx);
  float saw = fract(d * 11.0 + h * 5.0 + side * 0.37);
  float needle = 0.86 + 0.28 * vnoise(float2(a.y * scale * 55.0, id + side * 9.0));
  float inside = pow(d, 0.85) * 0.46 * (0.60 + 0.40 * saw) * needle + 0.008 - abs(sx);
  return float2(smoothstep(0.0, soft, inside), smoothstep(0.0, soft, inside) * smoothstep(0.075, 0.0, inside));
}

half4 main(float2 fragCoord) {
  float2 uv = fragCoord / u_res;
  float2 a = fragCoord / u_res.x;
  float H = u_res.y / u_res.x;
  float t = u_time * 0.12;
  // Işık kaynağı görünmez: ormanın arkasında geniş, yumuşak bir aydınlık. Nokta ya da ışın merkezi yok.
  float2 toSun = (a - float2(0.62, H * 0.66)) * float2(1.0, 0.72);
  float glow = exp(-dot(toSun, toSun) * 2.1);
  float3 col = mix(base0 + c2 * 0.20, base1 + c2 * 0.22, uv.y);
  col += mix(c2, c3, 0.45) * glow * (0.34 + u_hold * 0.30) * (0.72 + 0.28 * u_growth);
  // Tepeden süzülen demetler, ekranın dışından gelir
  float fan = (a.x - 0.62) / (a.y + 0.55);
  float shafts = vnoise(float2(fan * 7.0 + t * 0.7, t * 0.6));
  col += mix(c1, c3, 0.5) * shafts * shafts * exp(-uv.y * 2.1) * (0.30 + u_hold * 0.35);
  // Gökte ağır akan sis
  float2 p = a * 2.4;
  // Akış: tüm sis aynı yöne sürüklenir, içinde kıvrılır. Kıvrım hızı akıştan ayrı; hareket gözle takip edilebilir ama ani değil.
  float2 flow = float2(u_time * 0.14, u_time * 0.018);
  float2 w = float2(fbm2(p + float2(t * 2.2, t * 1.3)), fbm2(p + float2(5.2 - t * 1.8, 1.3 + t * 2.0)));
  float n = fbm(p - flow + w * 2.0);
  float thin = 1.0 - u_hold * 0.45;
  float density = smoothstep(0.30, 0.68, n) * thin;
  float3 fog = mix(c2, c1, n * 0.8) + c3 * glow * 0.16;
  col = mix(col, fog, density * 0.48);
  if (uv.y > 0.40 && u_sky < 0.5) {
    // Uzaktan yakına dört sıra: sisle solar, yaklaştıkça koyulaşır, kenarı hafifçe ışık alır. Aralarından farklı hızda sis kümeleri geçer.
    float bank1 = smoothstep(0.34, 0.72, fbm2(float2(a.x * 1.4 - u_time * 0.11, a.y * 3.2)));
    float bank2 = smoothstep(0.32, 0.70, fbm2(float2(a.x * 1.8 + 3.0 - u_time * 0.18, a.y * 3.6 + 4.0)));
    float bank3 = smoothstep(0.30, 0.68, fbm2(float2(a.x * 2.3 + 7.0 - u_time * 0.28, a.y * 4.2 + 9.0)));
    float2 r = float2(max(pines(a, H * 0.72, 19.0, 2.0, 0.16).x, pines(a, H * 0.72, 13.0, 21.0, 0.16).x), 0.0);
    col = mix(col, mix(base0, c2, 0.46) + c3 * glow * 0.14, r.x * 0.62);
    col = mix(col, fog, (0.30 + bank1 * 0.55) * thin * smoothstep(H * 0.52, H * 0.72, a.y));
    float2 r1 = pines(a, H * 0.84, 11.0, 7.0, 0.09);
    float2 r2 = pines(a, H * 0.84, 8.0, 33.0, 0.09);
    r = float2(max(r1.x, r2.x), max(r1.y, r2.y));
    col = mix(col, mix(base0, c2, 0.20) + c3 * glow * 0.06, r.x * 0.88);
    col += c3 * r.y * glow * 0.22;
    col = mix(col, fog * 0.74, (0.24 + bank2 * 0.55) * thin * smoothstep(H * 0.66, H * 0.84, a.y));
    r1 = pines(a, H * 0.96, 6.5, 13.0, 0.05);
    r2 = pines(a, H * 0.96, 4.6, 41.0, 0.05);
    r = float2(max(r1.x, r2.x), max(r1.y, r2.y));
    col = mix(col, base1 + c2 * 0.07, r.x);
    col += mix(c2, c3, 0.5) * r.y * glow * 0.26;
    col = mix(col, fog * 0.46, (0.16 + bank3 * 0.50) * thin * smoothstep(H * 0.78, H * 0.97, a.y));
    r = pines(a, H * 1.06, 3.9, 57.0, 0.03);
    col = mix(col, base1 * 0.42, r.x);
    col += mix(c2, c3, 0.5) * r.y * glow * 0.24;
  }
  // OYUN: başta orman sisin ardında neredeyse görünmez; odaklandıkça sis kalkar, ışık artar.
  float veil = (1.0 - u_growth) * 0.62;
  col = mix(col, mix(c2, c1, 0.35 + n * 0.3) * (0.62 + n * 0.4), veil * (0.92 - veil * 0.10) * smoothstep(H * 0.22, H * 0.66, a.y + (n - 0.5) * 0.35));
  // OYUN: her 5 dakikada bir ateşböceği kalıcı olarak gelir; ormanın içinde ağır ağır gezer.
  for (int l = 0; l < 12; l++) {
    float fl = float(l);
    if (fl >= u_lights) break;
    float2 home = float2(0.07 + 0.075 * fl + 0.03 * hash(float2(fl, 2.0)), (0.58 + 0.34 * hash(float2(fl, 6.0))) * H);
    float2 pc = home + float2(0.045 * sin(u_time * 0.22 + fl * 2.1), 0.032 * cos(u_time * 0.17 + fl * 3.3));
    float dd = length(a - pc) / min(1.0, H / 1.4);
    float fresh = step(u_lights - 1.0, fl) * u_born;
    float pulse = 0.68 + 0.32 * sin(u_time * 0.45 + fl * 1.7);
    col += c3 * (smoothstep(0.011, 0.0, dd) + 0.24 * smoothstep(0.075 + fresh * 0.14, 0.0, dd) * (1.0 + fresh * 2.0)) * pulse;
  }
  // Ateşböcekleri: alt yarıda küçük, keskin çekirdek ve yumuşak hale; kendi ritminde yanıp söner
  float2 sq = fragCoord / min(u_res.x, u_res.y);
  float2 g = sq * 5.0;
  float2 id = floor(g);
  float2 f = fract(g) - 0.5;
  float h = hash(id + 3.1);
  float2 o = 0.3 * float2(sin(u_time * 0.35 + h * 20.0), cos(u_time * 0.27 + h * 13.0));
  float d = length(f - o);
  float pulse = 0.5 + 0.5 * sin(u_time * (0.30 + 0.25 * h) + h * 30.0);
  float fly = (smoothstep(0.022, 0.0, d) + 0.16 * smoothstep(0.17, 0.0, d)) * step(0.84 - 0.12 * u_growth, h) * pulse;
  col += (c3 * 1.0 + c1 * 0.1) * fly * smoothstep(0.42, 0.62, uv.y) * (1.0 - u_sky);
  return half4(film(col, fragCoord), 1.0);
}
`;

export const SCENE_SOURCES: Record<FocusSceneId, string> = { aurora: NEBULA_SKSL, tide: TIDE_SKSL, ember: EMBER_SKSL, mist: MIST_SKSL };

/** Düşük güç: gürültü oktavları yarıya iner. Yalnız gereken cihazda derlenir. */
export const liteShader = (src: string) => src.replace(/k < 4/g, 'k < 2').replace(/n < 4/g, 'n < 2').replace(/i < 4/g, 'i < 2');
