import { createClient } from '@supabase/supabase-js';

// 공개(publishable) 키는 브라우저에 넣어도 되는 키입니다.
// 데이터 보호는 Supabase의 RLS 규칙(본인 데이터만 읽고 쓰기)이 담당합니다.
const SUPABASE_URL = 'https://hxhwncbetmnurjwvnvlv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Kk2QV9JeUoP70JITBHEVgg_rqdXj908';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
