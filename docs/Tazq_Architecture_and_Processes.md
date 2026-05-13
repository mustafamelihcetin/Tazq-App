# TAZQ Uygulaması Kapsamlı Mimari ve Süreç Analizi

Bu doküman, Tazq uygulamasının uçtan uca mimarisini, teknoloji yığınını, iş süreçlerini ve güvenlik modellerini tüm açılardan kategorize ederek detaylandırmaktadır.

## 1. Genel Bakış

**Tazq**, Malthen ekosistemi çatısı altında geliştirilen ilk üretkenlik uygulamasıdır. Akıllı görev yönetimi ile Pomodoro tarzı odaklanma zamanlayıcısını (focus timer) birleştiren, yapay zeka destekli, tam yığın (full-stack) ve çapraz platform (cross-platform) bir üretkenlik uygulamasıdır. Kullanıcıların görevlerini doğal dil işleme (NLP) ile oluşturmasına, sunucu-taraflı AES-GCM şifreleme ile güvenli bir şekilde saklamasına ve gelişmiş bir UI/UX deneyimiyle yönetmesine olanak tanır.

---

## 2. Sistem Mimarisi ve Teknoloji Yığını

Sistem, modern bir istemci-sunucu (client-server) mimarisine dayanmaktadır.

### 2.1. Backend Katmanı (Sunucu ve API)
**Teknolojiler:** ASP.NET Core 8.0, Entity Framework Core 9
**Kategoriler ve Bileşenler:**
*   **Controller'lar (Sunum Katmanı):**
    *   `AiController`: Groq LLM entegrasyonu ile doğal dilden görev ayrıştırma isteklerini karşılar.
    *   `TasksController`: Görevler için temel CRUD operasyonlarını yönetir. Pagination (sayfalama) desteği ile büyük veri setlerinde performansı garanti eder.
    *   `FocusSessionController`: Pomodoro oturumlarının, odaklanma sürelerinin ve istatistiklerinin (seri hesaplamaları vb.) takibini yapar.
    *   `UsersController`: Kayıt, giriş, profil yönetimi, şifre sıfırlama ve oturum yenileme işlemlerini üstlenir.
    *   `EmailController`: E-posta bildirimleri ve raporlamaları tetikler (service katmanı üzerinden).
*   **Service'ler (İş Mantığı Katmanı):**
    *   `GroqService`: LLM (llama-3.1-8b-instant) ile doğrudan iletişim kurarak metin analizi yapar. Polly ile exponential backoff retry policy ve çıktı validasyonu içerir.
    *   `CryptoService`: Kullanıcı verilerinin AES-GCM (Galois/Counter Mode) ile şifrelenmesi ve çözülmesini sağlar. Her kullanıcı için HMAC-SHA256 ile türetilmiş benzersiz anahtar kullanır.
    *   `JwtService`: JWT token üretimi (HMAC-SHA256, 60 dakika süre).
    *   `UserService`: PBKDF2-SHA256 (100.000 iterasyon + 16-byte salt) ile şifre hashleme, IP bazlı oturum kontrolü ve şifre sıfırlama akışı.
    *   `ScheduledEmailService` & `CustomEmailService`: Periyodik (1 saatlik kontrol) veya anlık e-posta (özetler, hatırlatıcılar) süreçlerini yönetir. Kullanıcının tercih ettiği bildirim saatine (`NotificationTimeOfDay`) göre çalışır. (Gmail SMTP)
    *   `FocusSessionService` & `TaskService`: Odaklanma ve görevlere ait kompleks iş kurallarını (tekrarlayan görevler, önceliklendirme, etiketleme, şifreli CRUD) uygular.
*   **Doğrulama (Validation):**
    *   FluentValidation ile `UserRegisterDtoValidator` (e-posta format, şifre karmaşıklığı kuralları) ve `TaskRequestDtoValidator` (başlık zorunluluğu, tarih validasyonu) uygulanır.
*   **Middleware:**
    *   `ErrorHandlingMiddleware`: 401/403 yanıtları için özel JSON formatı ve global exception handling sağlar.

### 2.2. Frontend Katmanı (İstemci - Mobil & Web)
**Teknolojiler:** React Native 0.83, Expo 55, Zustand, NativeWind, Moti, React Native Reanimated
**Kategoriler ve Bileşenler:**
*   **Sayfalar (Expo Router - Dosya Bazlı Yönlendirme):**
    *   `onboarding`, `login`, `register`: Kullanıcı katılımı ve kimlik doğrulama akışları.
    *   `index`, `tasks`, `focus`, `profile`: Ana uygulama işlevsellik sekmeleri.
*   **Bileşenler (UI/UX Katmanı):**
    *   `DynamicIsland`, `GlassCard`, `BentoCard`: Modern, cam efekti (glassmorphism) ve üst düzey iOS/Android etkileşim hissiyatı veren bileşenler.
    *   `SubtaskProgressRing`, `AnimatedBackground`: Kullanıcıyı görsel olarak ödüllendiren ve etkileşime teşvik eden Moti ve Reanimated tabanlı animasyonlar.
    *   `ErrorBoundary`: Global crash yakalama ve kullanıcıya yeniden deneme imkânı sunan hata sınırı bileşeni.
    *   `BottomNavBar`, `TazqLogo`: Navigasyon ve marka bileşenleri.
*   **Durum Yönetimi ve Yerelleştirme:**
    *   Zustand ile AsyncStorage birleştirilerek cihazda kalıcı, hızlı durum yönetimi sağlanır (Auth, Focus, Theme, Language store'ları).
    *   i18n-js ile Türkçe ve İngilizce tam dil desteği mevcuttur (~120+ çeviri anahtarı).
*   **İstemci-Taraflı NLP (Client-Side Intelligence):**
    *   `taskParser.ts`: TR/EN bilingual tarih, saat, öncelik ve etiket ayrıştırma motoru. Backend LLM'den bağımsız, offline da çalışır.
    *   `taskIntelligence.ts`: Yüksek hassasiyetli kategorilendirme motoru — 6 kategori, 70+ anchor kelime, yalnızca kesin eşleşmede etiketleme.
*   **Uygulama Güvenliği:**
    *   Auth Guard: Hydration sonrası segment analizi ile onboarding/login/ana sayfa yönlendirmesi.
    *   Expo Go uyumluluk katmanı: Native modül crash'lerini önleyen savunmacı yükleme mekanizması.
    *   Google Fonts: Plus Jakarta Sans, Manrope, Syne ile modern tipografi.

### 2.3. Veritabanı ve Altyapı
*   **Veritabanı:** PostgreSQL 17. İlişkisel veri modeli (`User`, `TaskItem`, `FocusSession`, `UserNotificationPreferences`, `PasswordResetToken`) kullanılır. Performans için explicit index'ler tanımlanmıştır (UserId, StartedAt, Token).
*   **Reverse Proxy:** Caddy 2 kullanılarak Malthen ekosistemi genelinde paylaşımlı trafik yönetimi sağlanır. Tüm Malthen ürünleri (Tazq, Portfolio) aynı Caddy instance'ını paylaşır.
*   **Konteynerizasyon:** Docker ve Docker Compose ile bağımsız ortamlar (Backend + PostgreSQL + Redis) ayağa kaldırılır. Healthcheck'ler ve sıralı başlatma (`service_healthy`) garantisi mevcuttur.
*   **Rate Limiting:** Redis-backed IP rate limiting (prodüksiyon), InMemory fallback (geliştirme) ile brute-force koruması.

---

## 3. Temel İş Süreçleri ve Akışlar

### 3.1. Akıllı Görev Yönetimi (NLP Süreci)
1.  **Girdi:** Kullanıcı frontend üzerinden serbest metin (örn: "Yarın saat 15:00'te toplantı yap") girer.
2.  **İstemci-Taraflı İşleme:** `taskParser.ts` metni anlık olarak ayrıştırır (tarih, saat, öncelik, etiket). Sonuç kullanıcıya öneri olarak gösterilir.
3.  **Sunucu-Taraflı İşleme:** İstek API üzerinden `AiController`'a gelir ve `GroqService` aracılığıyla llama-3.1-8b-instant modeline iletilir. Çıktı validasyonu ile boş title filtreleme ve geçersiz priority düzeltme yapılır.
4.  **Çıktı:** LLM, metni ayrıştırarak JSON formatında yapılandırılmış veri (başlık, tarih, saat, önem derecesi) döndürür.
5.  **Kayıt:** Bu veri, `CryptoService` ile AES-GCM şifrelenerek PostgreSQL veritabanına bir `TaskItem` olarak kaydedilir.

### 3.2. Odaklanma ve Pomodoro Süreci
1.  **Planlama:** Kullanıcı, UI üzerinden önceden tanımlanmış sürelerden (15/25/50/90 dk) birini seçer veya özel süre belirler.
2.  **Takip:** Frontend, oturum süresini cihaz üzerinde yönetir (`useFocusStore` ile timer rehydration, Pomodoro 4 tur sistemi, streak freeze). Oturum tamamlandığında backend'e bitiş sinyali gönderir.
3.  **İstatistik:** `FocusSessionService`, oturumu veritabanına kaydeder, kullanıcının "streak" (seri) bilgisini günceller ve haftalık performans verilerini oluşturur.

### 3.3. Bildirim ve Raporlama Süreci
*   `ScheduledEmailService`, arka planda saatlik kontrol döngüsüyle çalışarak kullanıcıların bildirim tercihlerine (`UserNotificationPreferences`) ve tercih ettikleri saate göre yaklaşan görevleri tespit eder.
*   Haftalık özetler ve görev dışa aktarımları hazırlanıp `CustomEmailService` üzerinden SMTP ile kullanıcıya gönderilir.
*   Mobil Push Notification altyapısı (Expo Notifications) mevcuttur; Expo Go uyumluluğu için geçici olarak mock'lanmıştır. EAS Custom Development Build ile aktifleştirilecektir.

---

## 4. Güvenlik ve Gizlilik Mimarisi

*   **Sunucu-Taraflı AES-GCM Şifreleme:** Her kullanıcının görev verisi (Title, Description, Tags, Subtasks), veritabanına yazılmadan önce `CryptoService` kullanılarak AES-GCM algoritması ile şifrelenir. Her kullanıcı için HMAC-SHA256 ile master key'den türetilmiş benzersiz anahtar kullanılır. Veritabanı sızdırılsa dahi veriler okunamaz.
*   **Kimlik Doğrulama:** JWT (JSON Web Token) ile 60 dakikalık oturum süresi. Şifreler PBKDF2-SHA256 ile tuzlanarak (16-byte salt) ve 100.000 iterasyon ile hashlenerek saklanır. IP bazlı session refresh kontrolü mevcuttur.
*   **Yetkilendirme:** Sistemde Rol Bazlı Erişim Kontrolü (RBAC) bulunur (Admin/User rolleri). Admin kullanıcı başlangıçta otomatik seed mekanizması ile oluşturulur.
*   **Sistem Güvenliği:**
    *   Global hata yönetimi (`ErrorHandlingMiddleware`) ile stack trace sızıntıları önlenir.
    *   Redis-backed IP rate limiting (dakikada 100, saatte 1000 istek) ile brute-force ve DDoS saldırılarına karşı önlem alınır.
    *   `X-App-Signature` header doğrulaması ile yetkisiz API erişimi engellenir (production).
    *   Swagger UI yalnızca geliştirme ortamında erişilebilirdir.

---

## 5. UI / UX Felsefesi

Tazq, standart bir üretkenlik uygulamasından öte, premium bir hissiyat sunmak üzere tasarlanmıştır:
*   **Görsel Mükemmellik:** Karanlık (Midnight Indigo) / Aydınlık (Ceramic White) mod desteğiyle birlikte, Material 3 seviyesinde 6 kademeli surface hierarchy, özel renk paletleri ve pürüzsüz geçişler (smooth gradients) kullanılır.
*   **Dinamik Etkileşim:** Görevleri sürükle-bırak (drag-to-reorder) ve kaydır-sil (swipe-to-delete) mekanikleri ile akıcı bir şekilde yönetme. Haptic feedback entegrasyonu.
*   **Mikro Animasyonlar:** Alt görevlerin tamamlanma durumunu gösteren `SubtaskProgressRing` (spring physics) ve ekranların alt arka planındaki `AnimatedBackground` gibi detaylarla canlı bir tasarım felsefesi uygulanır.
*   **Modern Tipografi:** Google Fonts (Plus Jakarta Sans, Manrope, Syne) ile premium font deneyimi.

## 6. Dağıtım ve DevOps (Deployment)

*   **Backend:** Docker Compose ile PostgreSQL, Redis ve ASP.NET Core API ayağa kaldırılır. `.env` dosyasıyla ortam değişkenleri yönetilir. Caddy üzerinden HTTPS ile dışarı açılır.
*   **Frontend:** EAS Build (Expo Application Services) aracılığıyla hem Android hem de iOS için bulutta native build'ler alınır (development, preview, production profilleri).
*   **Orkestrasyon:** `run.ps1` (v3.2) Smart Launch Script ile tüm geliştirme ortamı tek komutla yönetilir: port temizleme, Docker DB başlatma, full-stack concurrent launch, temizlik.
*   **Malthen Altyapı Paylaşımı:** Tüm Malthen ürünleri (Tazq, Portfolio vb.) aynı Caddy reverse proxy instance'ını ve Docker altyapısını paylaşır. Gelecekte `tazq.malthen.dev` gibi alt-domain yapısına geçiş planlanmaktadır.

## Özet

Tazq; sunucu-taraflı AES-GCM şifrelemeyi, yapay zeka entegrasyonunu (Groq LLM + istemci-taraflı NLP motoru), Redis-backed güvenlik katmanını ve üst düzey, dinamik bir kullanıcı deneyimini (Reanimated, Glassmorphism, Dynamic Island, Pomodoro) başarılı bir şekilde bir araya getiren, Malthen ekosistemi altında ölçeklenebilir ve modern bir mimariye sahiptir.
