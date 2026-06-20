/**
 * expo-av 16.0.8 references headers removed from expo-modules-core 56.x.
 * This script patches expo-av's iOS source files to inline missing protocol
 * definitions. Can be removed once expo-av ships a compatible release.
 */
const fs = require('fs');
const path = require('path');

const avIosDir = path.join(__dirname, '..', 'node_modules', 'expo-av', 'ios', 'EXAV');

if (!fs.existsSync(avIosDir)) {
  console.log('[fix-expo-av-headers] expo-av ios dir not found, skipping.');
  process.exit(0);
}

// ── Inline stubs for all removed headers ─────────────────────────────────────

const STUBS = {
  '#import <ExpoModulesCore/EXEventEmitter.h>': `\
// EXEventEmitter — inlined (removed from expo-modules-core 56.x)
#ifndef EXEventEmitter_h
#define EXEventEmitter_h
@protocol EXEventEmitter <NSObject>
- (NSArray<NSString *> *)supportedEvents;
- (void)startObserving;
- (void)stopObserving;
@end
#endif`,

  '#import <ExpoModulesCore/EXEventEmitterService.h>': `\
// EXEventEmitterService — inlined (removed from expo-modules-core 56.x)
#ifndef EXEventEmitterService_h
#define EXEventEmitterService_h
@protocol EXEventEmitterService <NSObject>
- (void)sendEventWithName:(NSString *)eventName body:(id)body;
@end
#endif`,

  '#import <ExpoModulesCore/EXLegacyExpoViewProtocol.h>': `\
// EXLegacyExpoViewProtocol — inlined (removed from expo-modules-core 56.x)
#ifndef EXLegacyExpoViewProtocol_h
#define EXLegacyExpoViewProtocol_h
#import <Foundation/Foundation.h>
@protocol EXLegacyExpoViewProtocol <NSObject>
@optional
- (void)setModuleRegistry:(id)moduleRegistry;
@end
#endif`,
};

// ── Files to patch ────────────────────────────────────────────────────────────

const filesToPatch = [
  path.join(avIosDir, 'EXAV.h'),
  path.join(avIosDir, 'EXAV.m'),
  path.join(avIosDir, 'EXAVTV.m'),
  path.join(avIosDir, 'Video', 'EXVideoView.h'),
  path.join(avIosDir, 'Video', 'EXVideoView.m'),
];

let patchedAny = false;

for (const filePath of filesToPatch) {
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const [importLine, stub] of Object.entries(STUBS)) {
    if (content.includes(importLine)) {
      content = content.replace(importLine, stub);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[fix-expo-av-headers] Patched', path.relative(avIosDir, filePath));
    patchedAny = true;
  }
}

if (!patchedAny) {
  console.log('[fix-expo-av-headers] All files already patched.');
}

console.log('[fix-expo-av-headers] Done.');
