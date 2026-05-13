# TAZQ Uygulaması Kapsamlı Mimari ve Süreç Analizi

Bu doküman, Tazq uygulamasının uçtan uca mimarisini, teknoloji yığınını, iş süreçlerini ve güvenlik modellerini tüm açılardan kategorize ederek detaylandırmaktadır.

## 1. Genel Bakış

**Tazq**, akıllı görev yönetimi ile Pomodoro tarzı odaklanma zamanlayıcısını (focus timer) birleştiren, yapay zeka destekli, tam yığın (full-stack) ve çapraz platform (cross-platform) bir üretkenlik uygulamasıdır. Kullanıcıların görevlerini doğal dil işleme (NLP) ile oluşturmasına, uçtan uca şifrelemeyle güvenli bir şekilde saklamasına ve gelişmiş bir UI/UX deneyimiyle yönetmesine olanak tanır.

---

## 2. Sistem Mimarisi ve Teknoloji Yığını

Sistem, modern bir istemci-sunucu (client-server) mimarisine dayanmaktadır.

### 2.1. Backend Katmanı (Sunucu ve API)
**Teknolojiler:** ASP.NET Core 8.0, Entity Framework Core 9
**Kategoriler ve Bileşenler:**
*   **Controller'lar (Sunum Katmanı):**
    *   `AiController`: Groq LLM entegrasyonu ile doğal dilden görev ayrıştırma isteklerini karşılar.
    *   `TasksController`: Görevler için temel CRUD operasyonlarını yönetir.
    *   `FocusSessionController`: Pomodoro oturumlarının, odaklanma sürelerinin ve istatistiklerinin (seri hesaplamaları vb.) takibini yapar.
    *   `UsersController`: Kayıt, giriş ve profil yönetimi işlemlerini üstlenir.
    *   `EmailController`: E-posta bildirimleri ve raporlamaları tetikler.
*   **Service'ler (İş Mantığı Katmanı):**
    *   `GroqService`: LLM (llama-3.1-8b-instant) ile doğrudan iletişim kurarak metin analizi yapar.
    *   `CryptoService`: Kullanıcı verilerinin AES (Advanced Encryption Standard) ile şifrelenmesi ve çözülmesini sağlar.
    *   `JwtService` & `PasswordHasher`: Güvenlik, token üretimi ve PBKDF2-SHA256 ile şifre hashleme.
    *   `ScheduledEmailService` & `CustomEmailService`: Periyodik veya anlık e-posta (özetler, hatırlatıcılar) süreçlerini yönetir (NETCore.MailKit / Gmail SMTP kullanılarak).
    *   `FocusSessionService` & `TaskService`: Odaklanma ve görevlere ait kompleks iş kurallarını (tekrarlayan görevler, önceliklendirme, etiketleme) uygular.

### 2.2. Frontend Katmanı (İstemci - Mobil & Web)
**Teknolojiler:** React Native 0.83, Expo 55, Zustand, NativeWind, Moti, React Native Reanimated
**Kategoriler ve Bileşenler:**
*   **Sayfalar (Expo Router - Dosya Bazlı Yönlendirme):**
    *   `onboarding`, `login`, `register`: Kullanıcı katılımı ve kimlik doğrulama akışları.
    *   `index`, `tasks`, `focus`, `profile`: Ana uygulama işlevsellik sekmeleri.
*   **Bileşenler (UI/UX Katmanı):**
    *   `DynamicIsland`, `GlassCard`, `BentoCard`: Modern, cam efekti (glassmorphism) ve üst düzey iOS/Android etkileşim hissiyatı veren bileşenler.
    *   `SubtaskProgressRing`, `AnimatedBackground`: Kullanıcıyı görsel olarak ödüllendiren ve etkileşime teşvik eden Moti ve Reanimated tabanlı animasyonlar.
*   **Durum Yönetimi ve Yerelleştirme:**
    *   Zustand ile AsyncStorage birleştirilerek cihazda kalıcı, hızlı durum yönetimi sağlanır.
    *   i18n-js ile Türkçe ve İngilizce tam dil desteği mevcuttur.

### 2.3. Veritabanı ve Altyapı
*   **Veritabanı:** PostgreSQL 17. İlişkisel veri modeli (`User`, `TaskItem`, `FocusSession`, `UserNotificationPreferences` vb.) kullanılır.
*   **Reverse Proxy:** Caddy 2 kullanılarak trafik yönetimi sağlanır.
*   **Konteynerizasyon:** Docker ve Docker Compose ile bağımsız ortamlar (Backend + DB) ayağa kaldırılır.

---

## 3. Temel İş Süreçleri ve Akışlar

### 3.1. Akıllı Görev Yönetimi (NLP Süreci)
1.  **Girdi:** Kullanıcı frontend üzerinden serbest metin (örn: "Yarın saat 15:00'te toplantı yap") girer.
2.  **İşleme:** İstek API üzerinden `AiController`'a gelir ve `GroqService` aracılığıyla llama-3.1-8b-instant modeline iletilir.
3.  **Çıktı:** LLM, metni ayrıştırarak JSON formatında yapılandırılmış veri (başlık, tarih, saat, önem derecesi) döndürür.
4.  **Kayıt:** Bu veri, `CryptoService` ile şifrelenerek PostgreSQL veritabanına bir `TaskItem` olarak kaydedilir.

### 3.2. Odaklanma ve Pomodoro Süreci
1.  **Planlama:** Kullanıcı, UI üzerinden önceden tanımlanmış sürelerden (15/25/50/90 dk) birini seçer veya özel süre belirler.
2.  **Takip:** Frontend, oturum süresini cihaz üzerinde yönetir ve oturum tamamlandığında backend'e bitiş sinyali gönderir.
3.  **İstatistik:** `FocusSessionService`, oturumu veritabanına kaydeder, kullanıcının "streak" (seri) bilgisini günceller ve haftalık performans verilerini oluşturur.

### 3.3. Bildirim ve Raporlama Süreci
*   `ScheduledEmailService`, arka planda düzenli olarak çalışarak kullanıcıların bildirim tercihlerine (`UserNotificationPreferences`) göre yaklaşan görevleri tespit eder.
*   Haftalık özetler ve görev dışa aktarımları hazırlanıp `CustomEmailService` üzerinden SMTP ile kullanıcıya gönderilir.
*   Ayrıca anlık mobil "Push Notification"lar (Expo Push) ile görev hatırlatıcıları çalıştırılır.

---

## 4. Güvenlik ve Gizlilik Mimarisi

*   **Uçtan Uca Şifreleme:** Her kullanıcının görev verisi, veritabanına yazılmadan önce `CryptoService` kullanılarak AES algoritması ile şifrelenir. Veritabanı sızdırılsa dahi veriler okunamaz.
*   **Kimlik Doğrulama:** Geleneksel oturumlar yerine güvenli JWT (JSON Web Token) kullanılır. Şifreler PBKDF2-SHA256 ile tuzlanarak (salt) ve hashlenerek saklanır.
*   **Yetkilendirme:** Sistemde Rol Bazlı Erişim Kontrolü (RBAC) bulunur (Admin/User rolleri).
*   **Sistem Güvenliği:** Global hata yönetimi ile stack trace sızıntıları önlenir. Rate limiting (istek sınırlandırma) uygulanarak brute-force ve DDoS saldırılarına karşı önlem alınır.

---

## 5. UI / UX Felsefesi

Tazq, standart bir üretkenlik uygulamasından öte, premium bir hissiyat sunmak üzere tasarlanmıştır:
*   **Görsel Mükemmellik:** Karanlık/Aydınlık mod desteğiyle birlikte, özel renk paletleri ve pürüzsüz geçişler (smooth gradients) kullanılır.
*   **Dinamik Etkileşim:** Görevleri sürükle-bırak (drag-to-reorder) ve kaydır-sil (swipe-to-delete) mekanikleri ile akıcı bir şekilde yönetme.
*   **Mikro Animasyonlar:** Alt görevlerin tamamlanma durumunu gösteren `SubtaskProgressRing` ve ekranların alt arka planındaki `AnimatedBackground` gibi detaylarla canlı bir tasarım felsefesi uygulanır.

## 6. Dağıtım ve DevOps (Deployment)

*   **Backend:** Docker Compose ile PostgreSQL ve ASP.NET Core API ayağa kaldırılır. `.env` dosyasıyla ortam değişkenleri yönetilir. Caddy üzerinden HTTPS ile dışarı açılır.
*   **Frontend:** EAS Build (Expo Application Services) aracılığıyla hem Android hem de iOS için bulutta native build'ler alınır.

## Özet

Tazq; güvenliği (AES, JWT), yapay zeka entegrasyonunu (Groq LLM) ve üst düzey, dinamik bir kullanıcı deneyimini (Reanimated, Glassmorphism, Dynamic Island) başarılı bir şekilde bir araya getiren, ölçeklenebilir ve modern bir mimariye sahiptir.
