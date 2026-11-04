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

// 메일 링크로 들어온 주소(#access_token=…&type=recovery)는 Supabase가 곧 지워 버리므로 먼저 읽어 둡니다
const urlHash = globalThis.location ? location.hash + location.search : '';
// 비밀번호 재설정 링크로 들어왔는지
export const RECOVERY_IN_URL = /type=recovery/.test(urlHash);
// 링크가 만료됐거나 이미 쓴 링크일 때의 오류 코드 (예: otp_expired)
export const URL_AUTH_ERROR = urlHash.match(/error_code=([\w-]+)/)?.[1] ?? null;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: extensionStorage ? { storage: extensionStorage } : {},
});
