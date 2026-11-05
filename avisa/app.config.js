require('dotenv').config();

module.exports = {
  expo: {
    name: 'avisa',
    slug: 'avisa',
    version: '1.0.0',
    plugins: ['expo-sqlite', 'expo-asset', 'expo-status-bar'],
    extra: {
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  },
};
