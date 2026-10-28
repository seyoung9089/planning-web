# planning-web

일정 관리를 귀찮아하는 고등학생을 위한 캘린더 + 투두리스트 서비스입니다.
메인 사이트와, 어느 탭에서든 옆에 여는 크롬 확장(사이드 패널) 두 부분으로 되어 있습니다.
둘 다 같은 Supabase 데이터베이스를 써서 한쪽에서 등록하면 다른 쪽에 바로 반영됩니다.

## 폴더 구조

| 경로 | 내용 |
| --- | --- |
| `index.html`, `src/main.js` | 메인 사이트 |
| `extension/` | 크롬 확장 (사이드 패널) |
| `src/shared/` | 둘이 같이 쓰는 코드 (Supabase 연결, 로그인, 할 일 목록, 기본 스타일) |

## 내 컴퓨터에서 실행하기

```bash
npm install
npm run dev              # 메인 사이트: http://localhost:5173
npm run build:extension  # 크롬 확장: dist-extension/ 폴더가 만들어집니다
```

### 크롬 확장 설치 (개발자 모드)

1. `npm run build:extension` 실행
2. 크롬 주소창에 `chrome://extensions` 입력
3. 오른쪽 위 **개발자 모드** 켜기
4. **압축해제된 확장 프로그램을 로드합니다** → `dist-extension` 폴더 선택
5. 툴바의 퍼즐 아이콘에서 고정한 뒤, 아이콘을 누르거나 **Alt+S**로 패널 열기

코드를 고친 뒤에는 다시 빌드하고 `chrome://extensions`에서 새로고침 버튼을 누르면 됩니다.

## 배포 (Cloudflare Pages)

Cloudflare 대시보드 → Workers & Pages → 만들기 → Pages → Git에 연결 → `planning-web` 저장소 선택 후:

- 프레임워크 프리셋: 없음 (또는 Vite)
- 빌드 명령: `npm run build`
- 빌드 출력 디렉터리: `dist`

이후 `main` 브랜치에 올라가는 변경은 자동으로 배포됩니다.

## Supabase

- 테이블: `events`(일정), `todos`(할 일). 둘 다 RLS로 **본인 데이터만** 읽고 쓸 수 있습니다.
- 대시보드 Authentication → URL Configuration의 **Site URL**을 배포된 주소로 바꿔야 인증 메일 링크가 올바른 곳으로 갑니다.
