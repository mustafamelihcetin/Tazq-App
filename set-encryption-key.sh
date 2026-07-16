#!/usr/bin/env bash
#
# ENCRYPTION_KEY'i mevcut JWT_KEY değerine eşitler — SIFIR RİSK.
#
# Neden gerekli: kod, ENCRYPTION_KEY tanımlı olmadığı için şifrelemeyi sessizce JWT
# anahtarına düşürüyordu. Bu iki anahtarın ömrü zıt (JWT döndürülmeli, şifreleme asla).
# Bu satır ikisini AYIRIR: mevcut veri aynı değerle okunmaya devam eder, JWT bundan
# sonra bağımsız döndürülebilir.
#
# Kullanım:   bash set-encryption-key.sh
# Sonra:      docker compose up -d --force-recreate tazq-backend
#
set -euo pipefail
cd "$(dirname "$0")"

ENV_FILE=".env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "HATA: $ENV_FILE bulunamadı. Bu betiği repo kökünde çalıştır." >&2
  exit 1
fi

# JWT_KEY satırını al (değeri = ilk '=' sonrası, tırnak varsa koru).
jwt_line="$(grep -E '^JWT_KEY=' "$ENV_FILE" || true)"
if [[ -z "$jwt_line" ]]; then
  echo "HATA: $ENV_FILE içinde JWT_KEY yok." >&2
  exit 1
fi
jwt_value="${jwt_line#JWT_KEY=}"

# Zaten varsa DOKUNMA — üzerine yazmak, farklı bir değer konmuşsa veriyi öldürür.
if grep -qE '^ENCRYPTION_KEY=' "$ENV_FILE"; then
  echo "ENCRYPTION_KEY zaten tanımlı — dokunulmadı."
  echo "Değerini bilerek değiştirmek istiyorsan .env'i elle düzenle (dikkat: yanlış"
  echo "değer mevcut şifreli veriyi okunamaz yapar)."
  exit 0
fi

# Yedek al — geri dönülebilir olsun.
cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%Y%m%d%H%M%S)"

# Ekle. printf ile, değeri echo'nun yorumlamasına bırakmadan.
printf 'ENCRYPTION_KEY=%s\n' "$jwt_value" >> "$ENV_FILE"

echo "✓ ENCRYPTION_KEY eklendi (JWT_KEY ile aynı değer). Yedek: $ENV_FILE.bak.*"
echo ""
echo "Şimdi backend'i yeniden başlat:"
echo "    docker compose up -d --force-recreate tazq-backend"
echo ""
echo "Doğrula (başlangıç uyarısı ARTIK GÖRÜNMEMELİ):"
echo "    docker compose logs tazq-backend | grep -i 'KRİTİK YAPILANDIRMA'"
