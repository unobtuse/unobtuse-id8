const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Exclude problematic native modules from web bundle
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    // Modules that don't fully support web
    const unsupportedModules = [
      'expo-blur',
    ];
    
    if (unsupportedModules.some(mod => moduleName.includes(mod))) {
      return {
        type: 'empty',
      };
    }
  }
  
  // Default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
