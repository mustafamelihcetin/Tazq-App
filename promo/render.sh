#!/usr/bin/env bash
# Tüm tanıtım videolarını promo/out/ altına üretir.
# App Store: H.264 + AAC stereo, 30 fps, yuv420p (Apple app preview şartı). Play: YouTube'a yüklenecek 1080p.
set -e
cd "$(dirname "$0")/video"
OUT=../out
mkdir -p "$OUT"
for id in Film-tr Film-en Play-tr Play-en AppStore-tr AppStore-en AppStoreIpad-tr AppStoreIpad-en; do
  npx remotion render "$id" "$OUT/$id.mp4" \
    --codec=h264 --crf=16 --pixel-format=yuv420p \
    --audio-codec=aac --audio-bitrate=256k \
    --concurrency=8 --log=error
  # Remotion tam aralık (yuvj420p) çıkarıyor; Apple standart yuv420p + High@4.0 bekliyor.
  ffmpeg -v error -y -i "$OUT/$id.mp4" -vf "scale=in_range=pc:out_range=tv,format=yuv420p" \
    -c:v libx264 -profile:v high -level 4.0 -crf 16 -preset slow -movflags +faststart -c:a copy "$OUT/tmp_$id.mp4"
  mv "$OUT/tmp_$id.mp4" "$OUT/$id.mp4"
  echo "bitti: $id"
done
