// ─────────────────────────────────────────────────────────────────────────────
//  TAZQ – Yasal Metinler / Legal Texts
//  Son güncelleme / Last updated: 2026-06-29
// ─────────────────────────────────────────────────────────────────────────────

export type LegalDocKey = 'terms' | 'privacy' | 'kvkk' | 'consent';

export interface LegalDoc {
  titleTr: string;
  titleEn: string;
  bodyTr: string;
  bodyEn: string;
}

// ── 1. KULLANICI SÖZLEŞMESİ / TERMS OF SERVICE ───────────────────────────────

const TERMS: LegalDoc = {
  titleTr: 'Kullanıcı Sözleşmesi',
  titleEn: 'Terms of Service',

  bodyTr: `KULLANICI SÖZLEŞMESİ

Son Güncelleme: 29 Haziran 2026
Yürürlük Tarihi: 29 Haziran 2026

Bu Kullanıcı Sözleşmesi ("Sözleşme"), TAZQ uygulamasını ("Uygulama") işleten Malthen ("Tazq", "Geliştirici", "biz") ile Uygulamayı kullanan gerçek kişi ("Kullanıcı", "siz") arasında akdedilmektedir.

Uygulamayı indirerek, kaydolarak veya kullanmaya devam ederek bu Sözleşme'nin tüm hükümlerini okuduğunuzu, anladığınızı ve kabul ettiğinizi beyan edersiniz.


1. TANIMLAR

1.1 "Uygulama": iOS ve Android platformlarında sunulan, görev yönetimi, odak zamanlayıcısı, alışkanlık takibi ve sınav planlama hizmetlerini kapsayan TAZQ mobil uygulamasıdır.

1.2 "Hesap": Kullanıcının Uygulamayı kullanabilmesi için oluşturduğu kişisel profili ifade eder.

1.3 "İçerik": Kullanıcının Uygulama aracılığıyla oluşturduğu görev, not, alışkanlık kaydı ve benzeri verileri kapsar.

1.4 "Hizmet": Tazq'ın Uygulama üzerinden sunduğu tüm dijital hizmetleri ifade eder.


2. HESAP OLUŞTURMA VE GÜVENLİK

2.1 Uygulamayı kullanabilmek için en az 13 (on üç) yaşında olmanız gerekmektedir. 18 yaşından küçük kullanıcıların ebeveyn veya yasal vasi onayı alması zorunludur.

2.2 Kayıt sırasında doğru, güncel ve eksiksiz bilgi vermeyi kabul edersiniz. Verilen yanıltıcı bilgilerden doğan her türlü sorumluluk kullanıcıya aittir.

2.3 Hesap şifrenizin gizliliğini korumakla ve yetkisiz erişimleri derhal Tazq'a bildirmekle yükümlüsünüz. Şifrenizin üçüncü kişilerle paylaşılması durumunda oluşabilecek zararlardan Tazq sorumlu tutulamaz.

2.4 Her kullanıcı yalnızca bir hesap açabilir. Aynı kişiye ait birden fazla hesap tespit edilmesi durumunda tüm hesaplar askıya alınabilir.


3. HİZMETİN KAPSAMI VE KULLANIM KOŞULLARI

3.1 Tazq, Kullanıcı'ya şu hizmetleri sunar:
   – Görev oluşturma, önceliklendirme ve takibi
   – Pomodoro tabanlı odak zamanlayıcısı
   – Alışkanlık oluşturma ve günlük takip
   – Sınav tarihi planlama ve çalışma programı oluşturma
   – Kişisel istatistikler ve haftalık ilerleme raporları
   – Anlık bildirimler ve hatırlatıcılar

3.2 Kullanıcı, Uygulamayı yalnızca kişisel, ticari olmayan amaçlarla kullanmayı kabul eder.

3.3 Aşağıdaki eylemler kesinlikle yasaktır:
   a) Uygulamanın kaynak kodunu tersine mühendislik yöntemiyle inceleme, kopyalama veya değiştirme;
   b) Otomatik araçlar (bot, scraper vb.) aracılığıyla sistematik veri toplama;
   c) Sunuculara orantısız yük bindiren işlemler gerçekleştirme;
   d) Üçüncü kişilerin haklarını ihlal eden içerik yükleme;
   e) Virüs, kötü amaçlı yazılım veya zararlı kod iletme;
   f) Başka kullanıcıların hesaplarına yetkisiz erişim sağlama.


4. FİKRİ MÜLKİYET HAKLARI

4.1 Uygulama, tasarım, yazılım kodu, içerik, grafikler, logolar ve marka unsurları dahil olmak üzere tüm fikri mülkiyet hakları Tazq'a aittir ve 5846 sayılı Fikir ve Sanat Eserleri Kanunu ile uluslararası telif hukuku kapsamında koruma altındadır.

4.2 Kullanıcı, kendi oluşturduğu İçerik üzerindeki haklarını saklı tutar. Bununla birlikte, Uygulamayı kullanmaya devam ettiği sürece Tazq'a söz konusu İçeriği hizmetin sunumu amacıyla işleme, depolama ve yedekleme konusunda münhasır olmayan, devredilemeyen ve ücretsiz bir lisans vermektedir.

4.3 Tazq'ın yazılı onayı olmaksızın uygulama içeriği ticari amaçla çoğaltılamaz, dağıtılamaz veya kamuya iletilemez.


5. ÜCRETLİ ÖZELLİKLER VE ABONELİK

5.1 Tazq, ücretsiz temel özellikler ile opsiyonel ücretli premium abonelik ("Tazq Pro") sunabilir.

5.2 Abonelik ücretleri, ödeme yönteminize bağlı olarak Apple App Store veya Google Play üzerinden tahsil edilir. Fiyatlandırma ve iade koşulları ilgili mağazanın politikalarına tabidir.

5.3 Tazq, önceden bildirimde bulunmak kaydıyla abonelik fiyatlarını değiştirme hakkını saklı tutar. Fiyat artışı bildirimini takip eden ilk yenileme döneminden itibaren yeni fiyat geçerli olur.

5.4 Abonelik, aksi belirtilmedikçe otomatik olarak yenilenir. İptali için ilgili mağaza ayarlarından aboneliğinizi sonlandırmanız gerekmektedir.


6. GİZLİLİK

Kişisel verilerinizin işlenmesine ilişkin detaylı bilgi için Gizlilik Politikamızı ve KVKK Aydınlatma Metni'ni incelemenizi önemle tavsiye ederiz. Bu belgeler Sözleşme'nin ayrılmaz bir parçasını oluşturmaktadır.


7. GARANTİ RED VE SORUMLULUK SINIRLAMASI

7.1 Tazq, Hizmet'i "olduğu gibi" (as-is) ve "mevcut olduğu şekilde" (as-available) sunmaktadır. Kesintisiz, hatasız veya güvenli bir hizmet sunulacağına ilişkin herhangi bir garanti verilmemektedir.

7.2 Tazq'ın Kullanıcı'ya karşı doğrudan veya dolaylı sorumluluğu, ilgili dönemde kullanıcının ödediği abonelik ücretini aşamaz. Ücretsiz kullanıcılar açısından bu sınır sıfırdır.

7.3 Kullanıcının veri kaybına uğramaması için düzenli yedek alınmasını tavsiye ederiz. Kullanıcı kaynaklı veri silme işlemlerinden Tazq sorumlu tutulamaz.

7.4 Mücbir sebep halleri (doğal afet, siber saldırı, altyapı kesintisi vb.) nedeniyle yaşanan hizmet aksaklıklarından Tazq sorumlu değildir.


8. HİZMETİN ASKIYA ALINMASI VE SONLANDIRILMASI

8.1 Tazq, bu Sözleşme'yi ihlal eden Kullanıcı'nın hesabını bildirimde bulunmaksızın askıya alma veya kalıcı olarak kapatma hakkını saklı tutar.

8.2 Kullanıcı, hesabını istediği zaman uygulama içi ayarlar menüsünden veya contact@malthen.io adresine talep göndererek kapatabilir. Hesap kapatma talebi işleme alındıktan sonra veriler 30 (otuz) gün içinde kalıcı olarak silinir.

8.3 Tazq, hizmetin tamamını veya belirli özelliklerini 30 (otuz) günlük önceden bildirimde bulunarak sonlandırabilir.


9. DEĞİŞİKLİKLER

9.1 Tazq, bu Sözleşme'yi tek taraflı olarak değiştirme hakkını saklı tutar. Önemli değişiklikler uygulama içi bildirim veya e-posta yoluyla duyurulur.

9.2 Bildirim tarihinden itibaren 30 (otuz) gün içinde Uygulamayı kullanmaya devam etmeniz yeni sözleşme koşullarını kabul ettiğiniz anlamına gelir. Kabul etmiyorsanız hesabınızı kapatma hakkına sahipsiniz.


10. UYGULANACAK HUKUK VE UYUŞMAZLIK ÇÖZÜMÜ

10.1 Bu Sözleşme, Türkiye Cumhuriyeti hukukuna tabidir.

10.2 Sözleşme'den doğabilecek uyuşmazlıklarda öncelikle taraflar arasında müzakere yoluyla çözüm aranacaktır. Müzakere yoluyla çözülemeyen uyuşmazlıklarda İstanbul Mahkemeleri ve İcra Daireleri yetkilidir.

10.3 Tüketici sıfatıyla kullanıcılar, 6502 sayılı Tüketicinin Korunması Hakkında Kanun kapsamındaki haklarını kullanmaya devam edebilir.


11. İLETİŞİM

Sözleşme'ye ilişkin sorularınız için:

Malthen
E-posta: contact@malthen.io
`,

  bodyEn: `TERMS OF SERVICE

Last Updated: June 29, 2026
Effective Date: June 29, 2026

This Terms of Service Agreement ("Agreement") is entered into between Malthen ("Tazq", "Developer", "we", "us") and the individual using the Application ("User", "you").

By downloading, registering, or continuing to use the Application, you represent that you have read, understood, and agree to all terms of this Agreement.


1. DEFINITIONS

1.1 "Application": The TAZQ mobile application available on iOS and Android platforms, providing task management, focus timer, habit tracking, and exam planning services.

1.2 "Account": The personal profile created by the User to access the Application.

1.3 "Content": Tasks, notes, habit records, and similar data created by the User through the Application.

1.4 "Service": All digital services provided by Tazq through the Application.


2. ACCOUNT CREATION AND SECURITY

2.1 You must be at least 13 years of age to use the Application. Users under 18 must obtain parental or legal guardian consent.

2.2 You agree to provide accurate, current, and complete information during registration. You are solely responsible for any consequences arising from false or misleading information.

2.3 You are responsible for maintaining the confidentiality of your password and for immediately notifying Tazq of any unauthorized access. Tazq shall not be held liable for damages arising from sharing your password with third parties.

2.4 Each user may maintain only one account. Detection of multiple accounts belonging to the same individual may result in suspension of all accounts.


3. SCOPE OF SERVICE AND CONDITIONS OF USE

3.1 Tazq provides the following services:
   – Task creation, prioritization, and tracking
   – Pomodoro-based focus timer
   – Habit creation and daily tracking
   – Exam date planning and study schedule creation
   – Personal statistics and weekly progress reports
   – Push notifications and reminders

3.2 You agree to use the Application solely for personal, non-commercial purposes.

3.3 The following actions are strictly prohibited:
   a) Reverse engineering, copying, or modifying the Application's source code;
   b) Systematic data collection using automated tools (bots, scrapers, etc.);
   c) Performing operations that impose a disproportionate load on servers;
   d) Uploading content that infringes on third-party rights;
   e) Transmitting viruses, malware, or harmful code;
   f) Gaining unauthorized access to other users' accounts.


4. INTELLECTUAL PROPERTY RIGHTS

4.1 All intellectual property rights in the Application, including design, software code, content, graphics, logos, and brand elements, belong to Tazq and are protected under Turkish Law No. 5846 on Intellectual and Artistic Works and international copyright law.

4.2 Users retain their rights to Content they create. However, by continuing to use the Application, you grant Tazq a non-exclusive, non-transferable, royalty-free license to process, store, and back up such Content for the purpose of providing the service.

4.3 Application content may not be reproduced, distributed, or communicated to the public for commercial purposes without Tazq's written consent.


5. PAID FEATURES AND SUBSCRIPTIONS

5.1 Tazq may offer free basic features along with an optional paid premium subscription ("Tazq Pro").

5.2 Subscription fees are charged through Apple App Store or Google Play depending on your payment method. Pricing and refund policies are subject to the respective store's policies.

5.3 Tazq reserves the right to change subscription prices with prior notice. New prices will apply from the first renewal period following the price change notice.

5.4 Subscriptions automatically renew unless otherwise specified. You must cancel through your store's subscription settings.


6. PRIVACY

We strongly encourage you to review our Privacy Policy and Data Protection Notice for details about how your personal data is processed. These documents form an integral part of this Agreement.


7. DISCLAIMER OF WARRANTIES AND LIMITATION OF LIABILITY

7.1 Tazq provides the Service "as-is" and "as-available" without warranty of any kind. No guarantee is made regarding uninterrupted, error-free, or secure service delivery.

7.2 Tazq's direct or indirect liability to the User shall not exceed the subscription fees paid by the User during the relevant period. For free users, this limit is zero.

7.3 We recommend taking regular backups to avoid data loss. Tazq shall not be held liable for data deletions caused by the User.

7.4 Tazq is not liable for service disruptions caused by force majeure events (natural disasters, cyber attacks, infrastructure outages, etc.).


8. SUSPENSION AND TERMINATION OF SERVICE

8.1 Tazq reserves the right to suspend or permanently close a User's account that violates this Agreement without prior notice.

8.2 Users may close their account at any time through the in-app settings or by submitting a request to contact@malthen.io. Data will be permanently deleted within 30 (thirty) days of account closure.

8.3 Tazq may discontinue all or specific features of the service with 30 (thirty) days' prior notice.


9. AMENDMENTS

9.1 Tazq reserves the right to unilaterally modify this Agreement. Material changes will be communicated through in-app notifications or email.

9.2 Continued use of the Application for 30 (thirty) days following the notice date constitutes acceptance of the new terms. If you do not agree, you have the right to close your account.


10. GOVERNING LAW AND DISPUTE RESOLUTION

10.1 This Agreement is governed by the laws of the Republic of Turkey.

10.2 Disputes arising from this Agreement shall first be resolved through negotiation between the parties. Unresolved disputes shall be subject to the jurisdiction of İstanbul Courts and Enforcement Offices.

10.3 Users acting as consumers may continue to exercise their rights under Law No. 6502 on Consumer Protection.


11. CONTACT

For questions regarding this Agreement:

Malthen
Email: contact@malthen.io
`,
};

// ── 2. GİZLİLİK POLİTİKASI / PRIVACY POLICY ─────────────────────────────────

const PRIVACY: LegalDoc = {
  titleTr: 'Gizlilik Politikası',
  titleEn: 'Privacy Policy',

  bodyTr: `GİZLİLİK POLİTİKASI

Son Güncelleme: 29 Haziran 2026

Malthen olarak kişisel verilerinizin güvenliği ve gizliliği en öncelikli taahhüdümüzdür. Bu Gizlilik Politikası, TAZQ uygulaması üzerinden hangi verileri topladığımızı, bu verileri nasıl kullandığımızı, kimlerle paylaştığımızı ve haklarınızı nasıl kullanabileceğinizi açıklamaktadır.

Politika, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK), Avrupa Genel Veri Koruma Tüzüğü (GDPR) ve uygulanabilir diğer mevzuat çerçevesinde hazırlanmıştır.


1. VERİ SORUMLUSU

Malthen
E-posta: contact@malthen.io


2. TOPLANAN VERİLER

2.1 Hesap Verileri
Kaydolduğunuzda aşağıdaki bilgileri toplarız:
   – Ad (soyad isteğe bağlı)
   – E-posta adresi
   – Şifreli (hash'lenmiş) parola
   – Profil fotoğrafı (isteğe bağlı)

2.2 Uygulama Kullanım Verileri
Hizmetimizi kullanırken oluşturduğunuz veriler:
   – Görevler, başlıklar, açıklamalar, son tarihler ve öncelik seviyeleri
   – Alışkanlık kayıtları ve tamamlanma tarihleri
   – Odak oturumu süreleri ve sayıları
   – Sınav tarihleri ve çalışma planları
   – Uygulama içi tercihler (tema, dil, bildirim ayarları)
   – Seviye, rozet ve başarı verileri

2.3 Teknik Veriler
Uygulama performansını ve güvenliği sağlamak amacıyla:
   – Cihaz türü, işletim sistemi ve sürümü
   – Uygulama sürümü
   – Çökme raporları ve hata günlükleri (anonim)
   – IP adresi (kötüye kullanım tespiti için)
   – Oturum açma zaman damgaları

2.4 Bildirim Verileri
   – Bildirim izin durumu
   – Kullanıcı tarafından ayarlanan hatırlatıcı zamanları

2.5 Toplamadığımız Veriler
   – Konum bilgisi
   – Kamera veya mikrofon erişimi (açıkça izin verilmediği sürece)
   – Rehber/kişi listesi
   – Diğer uygulamalardaki etkinlik verileri


3. VERİLERİN İŞLENME AMAÇLARI

Toplanan veriler yalnızca aşağıdaki amaçlarla işlenmektedir:
   a) Hesap doğrulama ve güvenliğin sağlanması
   b) Uygulama hizmetlerinin sunulması ve kişiselleştirilmesi
   c) İlerleme istatistiklerinin hesaplanması ve görüntülenmesi
   d) Teknik destek sağlanması
   e) Uygulama performansının iyileştirilmesi
   f) Yasal yükümlülüklerin yerine getirilmesi
   g) Kullanıcı tercihlerine göre bildirim gönderilmesi


4. HUKUKİ DAYANAK

Verilerinizi aşağıdaki hukuki dayanaklar çerçevesinde işlemekteyiz:
   – Sözleşmenin ifası: Hesap ve hizmet yönetimi
   – Meşru menfaat: Güvenlik, kötüye kullanım önleme, performans iyileştirme
   – Açık rıza: Pazarlama bildirimleri, opsiyonel profil verileri
   – Yasal zorunluluk: Vergi, muhasebe ve yasal bildirim yükümlülükleri


5. VERİ SAKLAMA SÜRELERİ

   – Aktif hesap verileri: Hesap aktif olduğu sürece
   – Hesap kapatma sonrası: 30 gün içinde kalıcı silme
   – Anonim kullanım istatistikleri: 24 ay
   – Hukuki ihtilaf kayıtları: İhtilafın çözümünden itibaren 10 yıl
   – Çökme ve hata raporları: 12 ay


6. VERİLERİN PAYLAŞIMI

Kişisel verileriniz satılmaz, kiralanmaz veya ticari amaçla üçüncü kişilere aktarılmaz.

Verileriniz yalnızca aşağıdaki durumlarda paylaşılabilir:

6.1 Hizmet Sağlayıcılar
Uygulamanın çalışması için zorunlu altyapı hizmetleri sunan iş ortakları:
   – Bulut depolama (veri merkezi altyapısı)
   – E-posta gönderim hizmetleri (doğrulama, bildirim)
   – Çökme raporlama araçları (anonim)
   – Analitik araçlar (anonim, toplulaştırılmış)

Bu sağlayıcılar verilerinizi yalnızca tarafımızın talimatları doğrultusunda ve gizlilik taahhütleri kapsamında işler.

6.2 Yasal Zorunluluklar
Mahkeme kararı, savcılık talebi veya yürürlükteki mevzuat gerektirdiğinde.

6.3 İş Devri
Şirket birleşmesi, devir veya satın alma halinde alıcı taraf bu Politika'nın yükümlülüklerini devralmayı kabul ettiği takdirde.


7. VERİ GÜVENLİĞİ

Verilerinizin güvenliği için uygulanan teknik ve idari tedbirler:
   – AES-256 ile bekleyen veri şifreleme
   – TLS 1.3 ile aktarım sırasında şifreleme
   – JWT tabanlı güvenli kimlik doğrulama
   – Erişim kontrolü ve rol tabanlı yetkilendirme
   – Düzenli güvenlik denetimi ve penetrasyon testi
   – Çalışanlar için zorunlu veri güvenliği eğitimi


8. ÇOCUKLARIN GİZLİLİĞİ

Uygulama, 13 yaşın altındaki çocuklara yönelik değildir ve onlardan bilerek kişisel veri toplanmaz. 13 yaşından küçük bir çocuğun hesap oluşturduğunu fark etmeniz durumunda lütfen contact@malthen.io adresine bildirin.


9. ULUSLARARASI VERİ AKTARIMI

Sunucularımız Türkiye ve/veya Avrupa Ekonomik Alanı (AEA) sınırları içindeki veri merkezlerinde konuşlandırılmıştır. AEA dışına veri aktarımı gerektiğinde Avrupa Komisyonu'nun Standart Sözleşme Maddeleri (SCC) uygulanır.


10. KULLANICILARINHAKLARINIZINKULLANILMASI

KVKK ve GDPR kapsamında aşağıdaki haklara sahipsiniz:

   a) Bilgi Edinme Hakkı: İşlenen verileriniz hakkında bilgi talep etme
   b) Erişim Hakkı: Verilerinizin bir kopyasını talep etme
   c) Düzeltme Hakkı: Hatalı verilerin düzeltilmesini isteme
   d) Silme Hakkı ("Unutulma Hakkı"): Verilerinizin silinmesini talep etme
   e) İşlemeyi Kısıtlama Hakkı: Belirli işlemlerin durdurulmasını isteme
   f) Taşınabilirlik Hakkı: Verilerinizi yapılandırılmış formatta alma
   g) İtiraz Hakkı: Meşru menfaat dayanağıyla yapılan işlemlere itiraz
   h) Otomatik Karar Almaya İtiraz: Tamamen otomatik kararlara itiraz

Haklarınızı kullanmak için contact@malthen.io adresine yazılı başvuru yapabilirsiniz. Talepler 30 gün içinde yanıtlanır. Yanıtımızı yetersiz bulursanız Kişisel Verileri Koruma Kurumu'na (KVKK) şikâyette bulunma hakkınız saklıdır.


11. ÇEREZLER VE İZLEME TEKNOLOJİLERİ

Uygulama, oturum yönetimi için yalnızca işlevsel çerezler/yerel depolama kullanmaktadır. Reklam amaçlı veya üçüncü taraf takip çerezleri kullanılmamaktadır.


12. POLİTİKA DEĞİŞİKLİKLERİ

Bu Politika'da yapılacak önemli değişiklikler uygulama içi bildirim veya e-posta yoluyla en az 14 gün önceden duyurulacaktır. Güncel Politika her zaman uygulama içinde erişilebilir olacaktır.


13. İLETİŞİM

Gizlilik konusundaki soru ve talepleriniz için:
Malthen – Veri Koruma Birimi
E-posta: contact@malthen.io
`,

  bodyEn: `PRIVACY POLICY

Last Updated: June 29, 2026

At Malthen, the security and privacy of your personal data is our foremost commitment. This Privacy Policy explains what data we collect through the TAZQ application, how we use it, with whom we share it, and how you can exercise your rights.

This Policy has been prepared in accordance with Turkish Law No. 6698 on the Protection of Personal Data (KVKK), the General Data Protection Regulation (GDPR), and other applicable legislation.


1. DATA CONTROLLER

Malthen
Email: contact@malthen.io


2. DATA COLLECTED

2.1 Account Data
When you register, we collect:
   – First name (last name optional)
   – Email address
   – Encrypted (hashed) password
   – Profile photo (optional)

2.2 Application Usage Data
Data you create while using our service:
   – Tasks, titles, descriptions, due dates, and priority levels
   – Habit records and completion dates
   – Focus session durations and counts
   – Exam dates and study plans
   – In-app preferences (theme, language, notification settings)
   – Level, badge, and achievement data

2.3 Technical Data
For application performance and security:
   – Device type, operating system, and version
   – Application version
   – Crash reports and error logs (anonymous)
   – IP address (for abuse detection)
   – Login timestamps

2.4 Notification Data
   – Notification permission status
   – User-set reminder times

2.5 Data We Do Not Collect
   – Location data
   – Camera or microphone access (unless explicitly permitted)
   – Contacts/address book
   – Activity data from other applications


3. PURPOSES OF DATA PROCESSING

Collected data is processed solely for the following purposes:
   a) Account verification and security
   b) Delivery and personalization of application services
   c) Calculation and display of progress statistics
   d) Technical support provision
   e) Application performance improvement
   f) Fulfillment of legal obligations
   g) Sending notifications based on user preferences


4. LEGAL BASIS

We process your data under the following legal bases:
   – Performance of contract: Account and service management
   – Legitimate interest: Security, abuse prevention, performance improvement
   – Explicit consent: Marketing notifications, optional profile data
   – Legal obligation: Tax, accounting, and statutory reporting requirements


5. DATA RETENTION PERIODS

   – Active account data: For as long as the account remains active
   – After account closure: Permanent deletion within 30 days
   – Anonymous usage statistics: 24 months
   – Legal dispute records: 10 years from resolution of dispute
   – Crash and error reports: 12 months


6. DATA SHARING

Your personal data is not sold, rented, or commercially transferred to third parties.

Your data may only be shared in the following circumstances:

6.1 Service Providers
Business partners providing essential infrastructure services:
   – Cloud storage (data center infrastructure)
   – Email delivery services (verification, notifications)
   – Crash reporting tools (anonymous)
   – Analytics tools (anonymous, aggregated)

These providers process your data only according to our instructions and subject to confidentiality commitments.

6.2 Legal Requirements
When required by court order, prosecutorial request, or applicable legislation.

6.3 Business Transfer
In the event of a company merger, transfer, or acquisition, provided the acquiring party agrees to assume the obligations of this Policy.


7. DATA SECURITY

Technical and administrative measures applied to protect your data:
   – Data at rest encryption using AES-256
   – Data in transit encryption using TLS 1.3
   – JWT-based secure authentication
   – Access control and role-based authorization
   – Regular security audits and penetration testing
   – Mandatory data security training for employees


8. CHILDREN'S PRIVACY

The Application is not directed at children under 13 and we do not knowingly collect personal data from them. If you become aware that a child under 13 has created an account, please notify us at contact@malthen.io.


9. INTERNATIONAL DATA TRANSFERS

Our servers are located in data centers within Turkey and/or the European Economic Area (EEA). Where data transfer outside the EEA is required, the European Commission's Standard Contractual Clauses (SCC) apply.


10. YOUR RIGHTS

Under KVKK and GDPR, you have the following rights:
   a) Right to Information: Request information about your processed data
   b) Right of Access: Request a copy of your data
   c) Right to Rectification: Request correction of inaccurate data
   d) Right to Erasure ("Right to be Forgotten"): Request deletion of your data
   e) Right to Restriction: Request that certain processing be suspended
   f) Right to Data Portability: Receive your data in a structured format
   g) Right to Object: Object to processing based on legitimate interest
   h) Right Against Automated Decision-Making: Object to fully automated decisions

To exercise your rights, submit a written request to contact@malthen.io. Requests are answered within 30 days. If you find our response inadequate, you retain the right to file a complaint with the Personal Data Protection Authority (KVKK Board).


11. COOKIES AND TRACKING TECHNOLOGIES

The Application uses only functional cookies/local storage for session management. No advertising or third-party tracking cookies are used.


12. POLICY CHANGES

Material changes to this Policy will be announced via in-app notification or email at least 14 days in advance. The current Policy will always be accessible within the application.


13. CONTACT

For privacy-related questions and requests:
Malthen – Data Protection Unit
Email: contact@malthen.io
`,
};

// ── 3. KVKK AYDINLATMA METNİ ─────────────────────────────────────────────────

const KVKK: LegalDoc = {
  titleTr: 'KVKK Aydınlatma Metni',
  titleEn: 'Data Protection Notice (KVKK)',

  bodyTr: `KİŞİSEL VERİLERİN KORUNMASI KANUNU KAPSAMINDA
AYDINLATMA METNİ

6698 Sayılı Kişisel Verilerin Korunması Kanunu'nun ("KVKK") 10. maddesi ve "Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ" kapsamında veri sorumlusu sıfatıyla aşağıdaki hususlarda sizi bilgilendirmek isteriz.


VERİ SORUMLUSU

Geliştirici / Marka : Malthen
E-posta             : contact@malthen.io


İŞLENEN KİŞİSEL VERİLER VE İŞLEME AMAÇLARI

▸ Kimlik Verileri
  Kapsam : Ad (soyad isteğe bağlı)
  Amaç   : Hesap oluşturma, hizmet sunumu

▸ İletişim Verileri
  Kapsam : E-posta adresi
  Amaç   : Hesap doğrulama, bildirim, şifre sıfırlama, teknik destek

▸ İşlem Güvenliği Verileri
  Kapsam : Şifreli parola, IP adresi, oturum zaman damgaları
  Amaç   : Kimlik doğrulama, kötüye kullanım önleme, güvenlik

▸ Görsel Veriler
  Kapsam : Profil fotoğrafı (isteğe bağlı)
  Amaç   : Kişiselleştirme

▸ Uygulama Kullanım Verileri
  Kapsam : Görevler, alışkanlıklar, odak süreleri, sınav planları, tercihler
  Amaç   : Hizmetin esas fonksiyonunun yerine getirilmesi, istatistik oluşturma, kişiselleştirme

▸ Teknik Veriler
  Kapsam : Cihaz bilgisi, işletim sistemi sürümü, uygulama sürümü, çökme raporları
  Amaç   : Performans izleme, hata ayıklama, güvenlik


HUKUKİ SEBEPLER

Kişisel verileriniz KVKK'nın 5. maddesi kapsamında aşağıdaki hukuki sebeplere dayanılarak işlenmektedir:

■ Madde 5/2-c – Sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması:
  Hesap yönetimi, görev/alışkanlık hizmetlerinin sunulması

■ Madde 5/2-ç – Veri sorumlusunun hukuki yükümlülüğünü yerine getirmesi:
  Vergi, muhasebe ve yasal saklama yükümlülükleri

■ Madde 5/2-f – Meşru menfaat:
  Güvenlik, kötüye kullanım tespiti, performans iyileştirme

■ Madde 5/1 – Açık rıza:
  Pazarlama bildirimleri ve isteğe bağlı profil verileri


VERİLERİN AKTARILMASI

Kişisel verileriniz yurt içinde; teknik altyapı, e-posta ve analitik hizmet sağlayıcılarına KVKK'nın 8. maddesi kapsamında aktarılabilmektedir.

Yurt dışına veri aktarımı söz konusu olduğunda KVKK'nın 9. maddesi uyarınca Kişisel Verileri Koruma Kurulu tarafından yeterli koruma seviyesi ilan edilmiş ülkelerle sınırlı tutulmakta veya ilgili kişinin açık rızası alınmaktadır.


VERİLERİN SAKLANMA SÜRESİ

Kişisel verileriniz; işleme amacının ortadan kalkması, hesabın kapatılması veya yasal saklama sürelerinin dolması hâlinde KVKK'nın 7. maddesi ve ilgili mevzuat çerçevesinde resen silinecek, yok edilecek veya anonim hâle getirilecektir.


KVKK'NIN 11. MADDESİ KAPSAMINDA HAKLARINIZ

Veri sahibi sıfatıyla aşağıdaki haklarınızı kullanabilirsiniz:

a) Kişisel verilerinizin işlenip işlenmediğini öğrenme,
b) Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme,
c) Kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme,
d) Yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme,
e) Kişisel verilerinizin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme,
f) KVKK'nın 7. maddesi çerçevesinde kişisel verilerinizin silinmesini veya yok edilmesini isteme,
g) (e) ve (f) bentleri uyarınca yapılan işlemlerin kişisel verilerinizin aktarıldığı üçüncü kişilere bildirilmesini isteme,
h) İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme,
i) Kişisel verilerinizin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme.


BAŞVURU YOLU

Yukarıda belirtilen haklarınızı kullanmak için:

   • E-posta: contact@malthen.io
   • Konu: "KVKK Veri Sahibi Başvurusu"
   • Kişilik teyidi için kimlik bilgilerinizi içeren başvuru

Başvurular en geç 30 (otuz) gün içinde yanıtlanacaktır. Başvurunuzun reddedilmesi, yanıtın yetersiz bulunması veya süresinde yanıt verilmemesi hâlinde Kişisel Verileri Koruma Kurumu'na şikâyette bulunma hakkınız saklıdır.
`,

  bodyEn: `DATA PROTECTION NOTICE

Prepared pursuant to Article 10 of Turkish Law No. 6698 on the Protection of Personal Data (KVKK) and the Communiqué on the Procedures and Principles to be Followed in Fulfilling the Obligation to Inform.

As data controller, we wish to inform you of the following.


DATA CONTROLLER

Developer / Brand : Malthen
Email             : contact@malthen.io


PERSONAL DATA PROCESSED AND PURPOSES

▸ Identity Data
  Scope   : First name (last name optional)
  Purpose : Account creation, service delivery

▸ Contact Data
  Scope   : Email address
  Purpose : Account verification, notifications, password reset, support

▸ Transaction Security Data
  Scope   : Encrypted password, IP address, session timestamps
  Purpose : Authentication, abuse prevention, security

▸ Visual Data
  Scope   : Profile photo (optional)
  Purpose : Personalization

▸ App Usage Data
  Scope   : Tasks, habits, focus times, exam plans, preferences
  Purpose : Core service delivery, statistics generation, personalization

▸ Technical Data
  Scope   : Device info, OS version, app version, crash reports
  Purpose : Performance monitoring, debugging, security


LEGAL BASES

Your personal data is processed under the following legal bases pursuant to Article 5 of KVKK:

■ Article 5/2-c – Directly related to the establishment or performance of a contract:
  Account management, delivery of task/habit services

■ Article 5/2-ç – Fulfillment of a legal obligation of the data controller:
  Tax, accounting, and statutory retention obligations

■ Article 5/2-f – Legitimate interest:
  Security, abuse detection, performance improvement

■ Article 5/1 – Explicit consent:
  Marketing notifications and optional profile data


DATA TRANSFERS

Your personal data may be transferred domestically to technical infrastructure, email, and analytics service providers under Article 8 of KVKK.

Where international data transfer is involved, it is limited to countries declared by the Personal Data Protection Board to have adequate protection, or your explicit consent is obtained, in accordance with Article 9 of KVKK.


DATA RETENTION

Your personal data will be deleted, destroyed, or anonymized ex officio upon cessation of the processing purpose, account closure, or expiry of statutory retention periods, in accordance with Article 7 of KVKK.


YOUR RIGHTS UNDER ARTICLE 11 OF KVKK

As a data subject, you may exercise the following rights:

a) Learning whether your personal data is being processed,
b) Requesting information if your personal data has been processed,
c) Learning the purpose of processing and whether data is used in accordance with that purpose,
d) Knowing the third parties to whom your data has been transferred,
e) Requesting correction of incomplete or incorrect data,
f) Requesting deletion or destruction of your data under Article 7 of KVKK,
g) Requesting that corrections and deletions be notified to third parties,
h) Objecting to outcomes arising against you through exclusively automated processing,
i) Requesting compensation for damages arising from unlawful processing.


HOW TO APPLY

To exercise your rights:
   • Email: contact@malthen.io
   • Subject: "KVKK Data Subject Request"
   • Include identity information for verification

Requests will be answered within 30 (thirty) days. If your request is rejected, the response is deemed insufficient, or no response is received within the time limit, you retain the right to file a complaint with the Personal Data Protection Authority (KVKK Board).
`,
};

// ── 4. AÇIK RIZA METNİ / EXPLICIT CONSENT FORM ───────────────────────────────

const CONSENT: LegalDoc = {
  titleTr: 'Açık Rıza Metni',
  titleEn: 'Explicit Consent Statement',

  bodyTr: `AÇIK RIZA METNİ

6698 Sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında, Malthen tarafından gerçekleştirilecek aşağıdaki kişisel veri işleme faaliyetlerine ilişkin açık rızamı bildiririm.

─────────────────────────────────────────────────────────────

I. HESAP VE HİZMET YÖNETİMİ

Ad-soyad ve e-posta adresimin; hesap oluşturulması, kimlik doğrulama, şifre sıfırlama ve hizmetin sunulması amacıyla Malthen tarafından işlenmesine ve Gizlilik Politikası'nda belirtilen altyapı hizmet sağlayıcılarıyla paylaşılmasına açıkça rıza gösteriyorum.

─────────────────────────────────────────────────────────────

II. UYGULAMA İÇİ VERİLER

Uygulama üzerinde oluşturduğum görev, alışkanlık, odak oturumu ve sınav planı verilerinin; hizmetin sunulması, istatistik oluşturulması ve deneyimin kişiselleştirilmesi amacıyla işlenmesine açıkça rıza gösteriyorum.

─────────────────────────────────────────────────────────────

III. BİLDİRİMLER VE İLETİŞİM

E-posta adresime; hizmet bildirimleri (güvenlik uyarıları, önemli güncellemeler) ve isteğe bağlı olarak ürün haberleri ile öneriler gönderilmesine rıza gösteriyorum. Pazarlama iletişimlerine olan rızamı uygulama ayarlarından veya her e-postanın altındaki bağlantı aracılığıyla istediğim zaman geri çekebileceğimi biliyor ve kabul ediyorum.

─────────────────────────────────────────────────────────────

IV. YURT DIŞI VERİ AKTARIMI

Sunucu altyapısının Türkiye veya AEA dışındaki bir ülkede konuşlandırıldığı durumlarda, kişisel verilerimin KVKK'nın 9. maddesi uyarınca yeterli korumayı sağlayan güvenceler kapsamında yurt dışına aktarılmasına rıza gösteriyorum.

─────────────────────────────────────────────────────────────

GENEL HUSUSLAR

• Bu rızayı vermek, Uygulamayı kullanabilmem için zorunlu değildir; ancak rıza gerektiren belirli özellikler (örneğin pazarlama bildirimleri) bu rıza olmaksızın kullanılamaz.

• Açık rızamı herhangi bir zamanda, herhangi bir gerekçe göstermeksizin geri çekme hakkına sahip olduğumu biliyor ve kabul ediyorum. Rıza geri çekme taleplerim için contact@malthen.io adresine başvurabilirim.

• Rızamın geri çekilmesi, geri çekme tarihinden önceki işlemlerin hukuka aykırı hale gelmesi sonucunu doğurmayacaktır.

• KVKK kapsamındaki tüm haklarım saklıdır.

Bu metni okudum, anladım ve içeriğine özgür irademle rıza gösteriyorum.
`,

  bodyEn: `EXPLICIT CONSENT STATEMENT

Pursuant to Turkish Law No. 6698 on the Protection of Personal Data (KVKK), I hereby provide my explicit consent for the following personal data processing activities to be carried out by Malthen

─────────────────────────────────────────────────────────────

I. ACCOUNT AND SERVICE MANAGEMENT

I explicitly consent to the processing of my name and email address by Malthen for the purposes of account creation, authentication, password reset, and service delivery, and to its sharing with infrastructure service providers specified in the Privacy Policy.

─────────────────────────────────────────────────────────────

II. IN-APP DATA

I explicitly consent to the processing of task, habit, focus session, and exam plan data I create within the Application for the purposes of service delivery, statistics generation, and experience personalization.

─────────────────────────────────────────────────────────────

III. NOTIFICATIONS AND COMMUNICATIONS

I consent to receiving service notifications (security alerts, important updates) and, optionally, product news and recommendations to my email address. I acknowledge and accept that I may withdraw my consent to marketing communications at any time through the app settings or via the link at the bottom of any email.

─────────────────────────────────────────────────────────────

IV. INTERNATIONAL DATA TRANSFER

Where server infrastructure is located in a country outside Turkey or the EEA, I consent to the transfer of my personal data abroad under safeguards providing adequate protection pursuant to Article 9 of KVKK.

─────────────────────────────────────────────────────────────

GENERAL PROVISIONS

• Providing this consent is not a prerequisite for using the Application; however, certain features requiring consent (e.g., marketing notifications) may not be available without it.

• I acknowledge that I have the right to withdraw my explicit consent at any time without giving any reason. I may submit withdrawal requests to contact@malthen.io.

• Withdrawal of consent shall not render lawful processing carried out prior to the withdrawal unlawful.

• All my rights under KVKK are reserved.

I have read and understood this statement and provide my consent freely and voluntarily.
`,
};

// ── Public Map ────────────────────────────────────────────────────────────────

export const LEGAL_DOCS: Record<LegalDocKey, LegalDoc> = {
  terms: TERMS,
  privacy: PRIVACY,
  kvkk: KVKK,
  consent: CONSENT,
};
