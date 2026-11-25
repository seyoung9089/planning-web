// 사이트에 로그인하면 크롬 확장(사이드 패널)도 같은 계정으로 로그인되게 합니다.
// 사이트 → 확장으로만 보내고, 확장은 보낸 곳이 우리 사이트가 맞는지(sender.origin) 확인한 뒤에만 받습니다
import { EXTENSION_ID } from './shared/extensionId.js';

function send(message) {
  const api = globalThis.chrome?.runtime?.sendMessage;
  if (!api) return; // 크롬이 아니거나 확장이 안 깔린 브라우저
  try {
    chrome.runtime.sendMessage(EXTENSION_ID, message, () => {
      void chrome.runtime.lastError; // 확장이 없으면 나는 오류는 무시합니다
    });
  } catch {
    /* 확장이 없으면 아무 일도 하지 않습니다 */
  }
}

let lastSent = null;
export function syncSessionToExtension(session) {
  if (!session) {
    if (lastSent !== null) send({ type: 'signout' });
    lastSent = null;
    return;
  }
  // 같은 토큰을 반복해서 보내지 않습니다
  if (session.access_token === lastSent) return;
  lastSent = session.access_token;
  send({ type: 'session', session: { access_token: session.access_token, refresh_token: session.refresh_token } });
}
