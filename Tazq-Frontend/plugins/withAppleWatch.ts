import {
  ConfigPlugin,
  withXcodeProject,
  withEntitlementsPlist,
  withInfoPlist,
  IOSConfig,
} from '@expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';

const APP_GROUP_ID = 'group.com.tazqapp.tazq';
const WATCH_APP_NAME = 'TazqWatch';
const WATCH_BUNDLE_ID = 'com.tazqapp.tazq.watchkitapp';
const WATCH_EXTENSION_BUNDLE_ID = 'com.tazqapp.tazq.watchkitapp.watchkitextension';

const withAppleWatch: ConfigPlugin = (config) => {
  // 1. Add App Group entitlement to iPhone app
  config = withEntitlementsPlist(config, (mod) => {
    const entitlements = mod.modResults;
    const existing = entitlements['com.apple.security.application-groups'];
    const groups: string[] = Array.isArray(existing) ? (existing as string[]) : [];
    if (!groups.includes(APP_GROUP_ID)) {
      (entitlements as any)['com.apple.security.application-groups'] = [...groups, APP_GROUP_ID];
    }
    return mod;
  });

  // 2. Add WatchConnectivity capability to Info.plist (no-op — handled by framework link)
  config = withInfoPlist(config, (mod) => {
    return mod;
  });

  // 3. Add Watch targets to Xcode project
  config = withXcodeProject(config, async (mod) => {
    const xcodeProject = mod.modResults;
    const projectRoot = mod.modRequest.projectRoot;
    const iosRoot = path.join(projectRoot, 'ios');

    // Copy Swift source files to ios/TazqWatch/
    const watchSrcDir = path.join(projectRoot, 'targets', 'tazq-watch');
    const watchDestDir = path.join(iosRoot, WATCH_APP_NAME);

    if (!fs.existsSync(watchDestDir)) {
      fs.mkdirSync(watchDestDir, { recursive: true });
    }

    const swiftFiles = fs.readdirSync(watchSrcDir).filter((f) => f.endsWith('.swift'));
    for (const file of swiftFiles) {
      fs.copyFileSync(path.join(watchSrcDir, file), path.join(watchDestDir, file));
    }

    // Write Watch App Info.plist
    const watchInfoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>Tazq</string>
  <key>CFBundleIdentifier</key>
  <string>${WATCH_BUNDLE_ID}</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>WKApplication</key>
  <true/>
  <key>WKWatchKitApp</key>
  <true/>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
  </dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${APP_GROUP_ID}</string>
  </array>
</dict>
</plist>`;
    fs.writeFileSync(path.join(watchDestDir, 'Info.plist'), watchInfoPlist);

    // Watch Complication Info.plist
    const complicationDir = path.join(iosRoot, 'TazqComplication');
    if (!fs.existsSync(complicationDir)) {
      fs.mkdirSync(complicationDir, { recursive: true });
    }
    const complicationInfoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>TazqComplication</string>
  <key>CFBundleIdentifier</key>
  <string>${WATCH_BUNDLE_ID}.complication</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${APP_GROUP_ID}</string>
  </array>
</dict>
</plist>`;
    fs.writeFileSync(path.join(complicationDir, 'Info.plist'), complicationInfoPlist);
    fs.copyFileSync(
      path.join(watchSrcDir, 'TazqComplication.swift'),
      path.join(complicationDir, 'TazqComplication.swift')
    );

    // Add Watch target to pbxproj
    addWatchTargetToXcodeProject(xcodeProject, watchDestDir, complicationDir, WATCH_APP_NAME);

    return mod;
  });

  return config;
};

function addWatchTargetToXcodeProject(
  xcodeProject: any,
  watchSrcDir: string,
  complicationDir: string,
  targetName: string
) {
  const uuid = () =>
    [...Array(24)].map(() => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');

  // Watch App target
  const watchTargetUUID = uuid();
  const watchBuildConfigListUUID = uuid();
  const watchDebugConfigUUID = uuid();
  const watchReleaseConfigUUID = uuid();
  const watchSourcesBuildPhaseUUID = uuid();
  const watchResourcesBuildPhaseUUID = uuid();
  const watchFrameworksBuildPhaseUUID = uuid();

  // Add build configurations
  xcodeProject.hash.project.objects['XCBuildConfiguration'] =
    xcodeProject.hash.project.objects['XCBuildConfiguration'] ?? {};
  const buildConfigs = xcodeProject.hash.project.objects['XCBuildConfiguration'];

  buildConfigs[watchDebugConfigUUID] = {
    isa: 'XCBuildConfiguration',
    buildSettings: {
      ALWAYS_SEARCH_USER_PATHS: 'NO',
      ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME: 'AccentColor',
      ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME: 'WidgetBackground',
      CLANG_ANALYZER_NONNULL: 'YES',
      CODE_SIGN_STYLE: 'Automatic',
      CURRENT_PROJECT_VERSION: '1',
      GENERATE_INFOPLIST_FILE: 'NO',
      INFOPLIST_FILE: `${targetName}/Info.plist`,
      IPHONEOS_DEPLOYMENT_TARGET: '16.4',
      MARKETING_VERSION: '1.0.0',
      PRODUCT_BUNDLE_IDENTIFIER: WATCH_BUNDLE_ID,
      PRODUCT_NAME: '$(TARGET_NAME)',
      SDKROOT: 'watchos',
      SKIP_INSTALL: 'YES',
      SWIFT_EMIT_LOC_STRINGS: 'YES',
      SWIFT_VERSION: '5.0',
      TARGETED_DEVICE_FAMILY: '4',
      WATCHOS_DEPLOYMENT_TARGET: '9.0',
    },
    name: 'Debug',
  };

  buildConfigs[watchReleaseConfigUUID] = {
    ...buildConfigs[watchDebugConfigUUID],
    name: 'Release',
  };

  // Build config list for Watch target
  xcodeProject.hash.project.objects['XCConfigurationList'] =
    xcodeProject.hash.project.objects['XCConfigurationList'] ?? {};
  xcodeProject.hash.project.objects['XCConfigurationList'][watchBuildConfigListUUID] = {
    isa: 'XCConfigurationList',
    buildConfigurations: [watchDebugConfigUUID, watchReleaseConfigUUID],
    defaultConfigurationIsVisible: 0,
    defaultConfigurationName: 'Release',
  };

  // Add source files to build phase
  const swiftFiles = fs
    .readdirSync(watchSrcDir)
    .filter((f) => f.endsWith('.swift') && f !== 'TazqComplication.swift');

  const sourceFileRefs: any[] = [];
  xcodeProject.hash.project.objects['PBXFileReference'] =
    xcodeProject.hash.project.objects['PBXFileReference'] ?? {};
  xcodeProject.hash.project.objects['PBXBuildFile'] =
    xcodeProject.hash.project.objects['PBXBuildFile'] ?? {};

  const fileRefs = xcodeProject.hash.project.objects['PBXFileReference'];
  const buildFiles = xcodeProject.hash.project.objects['PBXBuildFile'];

  for (const file of swiftFiles) {
    const fileRefUUID = uuid();
    const buildFileUUID = uuid();
    fileRefs[fileRefUUID] = {
      isa: 'PBXFileReference',
      lastKnownFileType: 'sourcecode.swift',
      name: file,
      path: `${targetName}/${file}`,
      sourceTree: '<group>',
    };
    buildFiles[buildFileUUID] = {
      isa: 'PBXBuildFile',
      fileRef: fileRefUUID,
    };
    sourceFileRefs.push({ value: buildFileUUID });
  }

  // Build phases
  xcodeProject.hash.project.objects['PBXSourcesBuildPhase'] =
    xcodeProject.hash.project.objects['PBXSourcesBuildPhase'] ?? {};
  xcodeProject.hash.project.objects['PBXSourcesBuildPhase'][watchSourcesBuildPhaseUUID] = {
    isa: 'PBXSourcesBuildPhase',
    buildActionMask: 2147483647,
    files: sourceFileRefs,
    runOnlyForDeploymentPostprocessing: 0,
  };

  xcodeProject.hash.project.objects['PBXResourcesBuildPhase'] =
    xcodeProject.hash.project.objects['PBXResourcesBuildPhase'] ?? {};
  xcodeProject.hash.project.objects['PBXResourcesBuildPhase'][watchResourcesBuildPhaseUUID] = {
    isa: 'PBXResourcesBuildPhase',
    buildActionMask: 2147483647,
    files: [],
    runOnlyForDeploymentPostprocessing: 0,
  };

  xcodeProject.hash.project.objects['PBXFrameworksBuildPhase'] =
    xcodeProject.hash.project.objects['PBXFrameworksBuildPhase'] ?? {};
  xcodeProject.hash.project.objects['PBXFrameworksBuildPhase'][watchFrameworksBuildPhaseUUID] = {
    isa: 'PBXFrameworksBuildPhase',
    buildActionMask: 2147483647,
    files: [],
    runOnlyForDeploymentPostprocessing: 0,
  };

  // Native target
  xcodeProject.hash.project.objects['PBXNativeTarget'] =
    xcodeProject.hash.project.objects['PBXNativeTarget'] ?? {};
  xcodeProject.hash.project.objects['PBXNativeTarget'][watchTargetUUID] = {
    isa: 'PBXNativeTarget',
    buildConfigurationList: watchBuildConfigListUUID,
    buildPhases: [
      { value: watchSourcesBuildPhaseUUID },
      { value: watchResourcesBuildPhaseUUID },
      { value: watchFrameworksBuildPhaseUUID },
    ],
    buildRules: [],
    dependencies: [],
    name: targetName,
    productName: targetName,
    productType: '"com.apple.product-type.application"',
  };

  // Add to project targets list
  const projectUUID = xcodeProject.hash.project.rootObject;
  const project = xcodeProject.hash.project.objects['PBXProject'][projectUUID];
  if (project && !project.targets.some((t: any) => t.value === watchTargetUUID)) {
    project.targets.push({ value: watchTargetUUID });
  }
}

export default withAppleWatch;
