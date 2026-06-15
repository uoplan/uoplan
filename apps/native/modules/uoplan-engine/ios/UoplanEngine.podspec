Pod::Spec.new do |s|
  s.name           = 'UoplanEngine'
  s.version        = '1.0.0'
  s.summary        = 'Native binding for the uoplan schedule-generation engine'
  s.description    = 'Links the Rust schedule-generation engine (built as an ' \
                     'XCFramework from packages/engine) and exposes it to JS ' \
                     'through the Expo Modules API. The same engine runs as WASM ' \
                     'on the web, so generated timetables are byte-for-byte identical.'
  s.author         = 'uoplan'
  s.homepage       = 'https://github.com/uoplan/uoplan'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/uoplan/uoplan.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # The Rust engine static library (device + simulator slices) with a module map
  # so Swift can `import UoplanEngineFFI`. Regenerate with
  # `pnpm build:engine-native-ffi`.
  s.vendored_frameworks = 'UoplanEngine.xcframework'

  s.source_files = '*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
