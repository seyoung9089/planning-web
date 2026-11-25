import { openInstallGuide } from './installGuide.js';
import { EXTENSION_ID } from './shared/extensionId.js';

// 아직 사이드 패널(크롬 확장)을 안 쓰는 사람에게 처음 한 번만 보여 주는 작은 안내.
// ×를 누르거나 설치 안내를 한 번 열면 다시 뜨지 않습니다. 확장이 깔려 있으면(신호에 답하면) 띄우지 않습니다
const KEY = 'planning-web:install-banner-closed';

function closedBefore() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true; // 기억할 수 없는 환경이면 매번 뜨지 않도록 아예 보이지 않습니다
  }
}
function remember() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // 괜찮습니다
  }
}

// 확장이 깔려 있으면 { version }을 돌려줍니다. 없거나 예전 버전이면 null
export function pingExtension(timeout = 800) {
  return new Promise((resolve) => {
    const send = globalThis.chrome?.runtime?.sendMessage;
    if (!send) return resolve(null);
    const timer = setTimeout(() => resolve(null), timeout);
    try {
      chrome.runtime.sendMessage(EXTENSION_ID, { type: 'ping' }, (reply) => {
        clearTimeout(timer);
        void chrome.runtime.lastError; // 확장이 없으면 생기는 오류는 무시합니다
        resolve(reply?.version ? reply : null);
      });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

export async function setupInstallBanner(banner) {
  if (closedBefore()) return;
  if (await pingExtension()) return;
  banner.hidden = false;
  banner.querySelector('.banner-main').addEventListener('click', () => {
    remember();
    banner.hidden = true;
    openInstallGuide();
  });
  banner.querySelector('.banner-close').addEventListener('click', () => {
    remember();
    banner.hidden = true;
  });
}
