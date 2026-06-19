require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'expo-watch-connectivity'
  s.version        = package['version']
  s.summary        = package['description']
  s.license        = package['license']
  s.homepage       = 'https://github.com/tazqapp/tazq'
  s.authors        = 'Tazq'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }

  s.source_files = 'ios/**/*.{swift,h,m}'

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
