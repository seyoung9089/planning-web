import { createClient } from '@supabase/supabase-js';

// 공개(publishable) 키는 브라우저에 넣어도 되는 키입니다.
// 데이터 보호는 Supabase의 RLS 규칙(본인 데이터만 읽고 쓰기)이 담당합니다.
const SUPABASE_URL = 'https://hxhwncbetmnurjwvnvlv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Kk2QV9JeUoP70JITBHEVgg_rqdXj908';

// 크롬 확장 안에서는 로그인 정보를 chrome.storage에 둡니다.
// 그래야 사이드 패널과 알림을 보내는 백그라운드가 같은 로그인을 함께 씁니다.
const extensionStorage = globalThis.chrome?.storage?.local
  ? {
      getItem: async (key) => (await chrome.storage.local.get(key))[key] ?? null,
      setItem: (key, value) => chrome.storage.local.set({ [key]: value }),
      removeItem: (key) => chrome.storage.local.remove(key),
    }
  : undefined;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: extensionStorage ? { storage: extensionStorage } : {},
});
