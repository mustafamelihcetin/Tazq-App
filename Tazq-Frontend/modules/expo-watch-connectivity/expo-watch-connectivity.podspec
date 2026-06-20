require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'expo-watch-connectivity'
  s.version        = package['version']
  s.summary        = 'Apple Watch connectivity placeholder (not yet in use)'
  s.license        = 'MIT'
  s.homepage       = 'https://github.com/tazqapp/tazq'
  s.author         = 'Tazq'
  s.platform       = :ios, '16.4'
  s.source         = { :path => '.' }

  # Source files intentionally empty — module is excluded from build until Watch integration is complete
  s.source_files   = 'ios/**/*.disabled'
end
