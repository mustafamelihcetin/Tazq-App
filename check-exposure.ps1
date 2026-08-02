<#
.SYNOPSIS
  Sunucunun DIŞARIYA ne açtığını doğrular. Her deploy'dan sonra çalıştırılır.

.DESCRIPTION
  ── NEDEN VAR ────────────────────────────────────────────────────────────────
  2026-08-03'te PostgreSQL portunun (65432) internete açık olduğu bulundu. Açık,
  ilk commit'ten beri oradaydı: yerelde geliştirme kolaylığı olarak eklenmiş
  ("5432:5432"), sonra 65432'ye taşınmış (bilinen portu terk etmek güvenliği
  artırmaz — sadece artırmış GİBİ hissettirir), ve Redis için tam bu hata sınıfı
  düzeltildiğinde (commit 2424d7c "Redis portunu internete kapatma") PostgreSQL
  aynı dosyada iki satır arayla atlanmıştı.

  Hatanın aylarca yaşamasının sebebi basit: projedeki HER güvenlik ağı kodu
  denetliyor — TypeScript, 1000+ Jest testi, 119 arka uç testi, kod incelemesi.
  Hiçbiri dağıtım topolojisine bakmıyor. Bir konteyner port bağlaması bunların
  hepsine görünmez.

      Bütün testler yeşil olabilir ve veritabanı internete açık olabilir.
      Testler KODU doğrular, DAĞITIMI değil.

  Bu betik o boşluğu kapatır ve bilerek DIŞARIDAN bakar: sunucunun içinden
  bakmak yanıltıcıdır, çünkü asıl soru "bu port dışarıdan erişilebiliyor mu?".

.EXAMPLE
  .\check-exposure.ps1
  .\check-exposure.ps1 -ServerHost 178.105.135.252 -ApiUrl https://api.tazqapp.com
#>

param(
  [string]$ServerHost = '178.105.135.252',
  [string]$ApiUrl     = 'https://api.tazqapp.com',
  [string]$SiteUrl    = 'https://tazqapp.com'
)

$ErrorActionPreference = 'Continue'
$failures = New-Object System.Collections.Generic.List[string]

# Açık OLMASI gerekenler. Bu liste bilinçli olarak KISA: her yeni satır,
# internete bakan yeni bir yüzey demektir ve gerekçesi yazılmalıdır.
$expectedOpen = @(
  @{ Port = 22;  Name = 'SSH' },
  @{ Port = 80;  Name = 'HTTP (Caddy → HTTPS yönlendirme)' },
  @{ Port = 443; Name = 'HTTPS' }
)

# Açık OLMAMASI gerekenler — altyapı servisleri asla internete bakmamalı.
$expectedClosed = @(
  @{ Port = 65432; Name = 'PostgreSQL (compose port eşlemesi)' },
  @{ Port = 5432;  Name = 'PostgreSQL (standart port)' },
  @{ Port = 6379;  Name = 'Redis' },
  @{ Port = 5200;  Name = 'Caddy (yerel geliştirme eşlemesi)' },
  @{ Port = 2019;  Name = 'Caddy yönetim API' },
  @{ Port = 8081;  Name = 'Metro geliştirme sunucusu' }
)

function Test-Port {
  param([string]$TargetHost, [int]$Port, [int]$TimeoutMs = 4000)
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect($TargetHost, $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) { return $false }
    $client.EndConnect($async)   # el sıkışma başarısızsa fırlatır
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

Write-Host ""
Write-Host "DIŞ ERİŞİM DENETİMİ  ·  $ServerHost" -ForegroundColor Cyan
Write-Host ("-" * 60)

Write-Host "`nAçık olması gerekenler:" -ForegroundColor Gray
foreach ($p in $expectedOpen) {
  if (Test-Port -TargetHost $ServerHost -Port $p.Port) {
    Write-Host ("  [ açık  ] {0,-6} {1}" -f $p.Port, $p.Name) -ForegroundColor Green
  } else {
    # Kapalı olması da bir SORUN: servis düşmüş olabilir.
    Write-Host ("  [ KAPALI] {0,-6} {1}" -f $p.Port, $p.Name) -ForegroundColor Yellow
    $failures.Add("Beklenen port KAPALI: $($p.Port) — $($p.Name). Servis düşmüş olabilir.")
  }
}

Write-Host "`nKapalı olması gerekenler:" -ForegroundColor Gray
foreach ($p in $expectedClosed) {
  if (Test-Port -TargetHost $ServerHost -Port $p.Port) {
    Write-Host ("  [ AÇIK !] {0,-6} {1}" -f $p.Port, $p.Name) -ForegroundColor Red
    $failures.Add("GÜVENLİK: $($p.Port) ($($p.Name)) internete AÇIK.")
  } else {
    Write-Host ("  [ kapalı] {0,-6} {1}" -f $p.Port, $p.Name) -ForegroundColor DarkGray
  }
}

Write-Host "`nUygulama sağlığı:" -ForegroundColor Gray
# PowerShell 5.1 varsayılanı eski TLS sürümleri; sunucu yalnız TLS 1.2+ kabul ettiği
# için bu satır olmadan HER istek "bağlanamadım" diye düşer.
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
$headers = @{ 'X-App-Signature' = 'tazq-expo-frontend' }

# Windows PowerShell 5.1 uyumlu.
#
# 5.1'de `Invoke-WebRequest` 2xx DIŞINDAKİ her yanıtta İSTİSNA fırlatır ve
# `-SkipHttpErrorCheck` (PowerShell 7) burada YOKTUR. Bu yüzden durum kodu
# istisnanın içinden okunuyor — aksi halde beklediğimiz 401 bile "bağlanamadım"
# gibi görünür ve betik kendi kontrolünü yanlış raporlar.
function Test-Endpoint {
  param([string]$Url, [int]$Expected, [string]$Label, [hashtable]$Headers = @{})
  $code = 0
  try {
    $r = Invoke-WebRequest -Uri $Url -Headers $Headers -Method Get -TimeoutSec 15 -UseBasicParsing
    $code = [int]$r.StatusCode
  } catch [System.Net.WebException] {
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
  } catch {
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
  }
  if ($code -eq $Expected) {
    Write-Host ("  [  {0}  ] {1}" -f $code, $Label) -ForegroundColor Green
  } else {
    Write-Host ("  [  {0}  ] {1}  (beklenen {2})" -f $code, $Label, $Expected) -ForegroundColor Red
    $script:failures.Add("$Label — HTTP $code döndü, beklenen $Expected.")
  }
}

Test-Endpoint -Url "$ApiUrl/health"     -Expected 200 -Label 'API /health'                  -Headers $headers
# Jetonsuz istek 401 DÖNMELİ. 200 dönerse kimlik doğrulama devre dışı kalmış demektir —
# yani herkesin verisi herkese açık. Bu kontrol o felaketi yakalar.
Test-Endpoint -Url "$ApiUrl/api/tasks"  -Expected 401 -Label 'API /api/tasks (jetonsuz)'    -Headers $headers
Test-Endpoint -Url $SiteUrl             -Expected 200 -Label 'Web sitesi'

Write-Host ""
Write-Host ("-" * 60)
if ($failures.Count -eq 0) {
  Write-Host "TEMİZ — beklenmeyen açık yüzey yok, uygulama sağlıklı." -ForegroundColor Green
  Write-Host ""
  exit 0
}

Write-Host "$($failures.Count) SORUN BULUNDU" -ForegroundColor Red
foreach ($f in $failures) { Write-Host "  · $f" -ForegroundColor Red }
Write-Host ""
Write-Host "Bir port yanlışlıkla açıldıysa: /root/docker-compose.yml içinde eşlemeyi" -ForegroundColor Yellow
Write-Host "'127.0.0.1:PORT:PORT' biçimine çevir, sonra 'docker compose up -d <servis>'." -ForegroundColor Yellow
Write-Host ""
exit 1
