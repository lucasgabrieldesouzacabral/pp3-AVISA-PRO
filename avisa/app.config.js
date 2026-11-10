require('dotenv').config();

module.exports = {
  expo: {
    name: 'avisa',
    slug: 'avisa',
    version: '1.0.0',
    android: {
      package: 'com.avisa',
    },
    ios: {
      bundleIdentifier: 'org.name.avisa',
    },
    plugins: ['expo-sqlite', 'expo-asset', 'expo-status-bar', 'expo-notifications'],
    extra: {
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      EXPO_PUBLIC_EAS_PROJECT_ID: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
      eas: {
        projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
      },
    },
  },
};
