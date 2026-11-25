// "크롬 확장 설치" 안내 창: 웹스토어에 올리기 전까지는 개발자 모드로 설치합니다
const dialog = document.createElement('dialog');
dialog.className = 'install-dialog';
dialog.innerHTML = `
  <h2>🧩 어느 화면에서든 쓰는 사이드 패널 설치</h2>
  <p class="lead">설치하면 유튜브를 보다가도 <kbd>Alt</kbd>+<kbd>S</kbd> 한 번으로 옆에 일정 패널이 열려요.</p>
  <ol>
    <li><a class="download" href="/planning-web-extension.zip" download>확장 파일 내려받기 (zip)</a></li>
    <li>받은 zip 파일의 <b>압축을 풉니다</b>. <code>planning-web-extension</code> 폴더가 생겨요.</li>
    <li>크롬 주소창에 <code>chrome://extensions</code> 를 입력합니다.
      <button type="button" class="copy">주소 복사</button></li>
    <li>오른쪽 위 <b>개발자 모드</b>를 켭니다.</li>
    <li><b>압축해제된 확장 프로그램을 로드합니다</b>를 누르고 2번의 폴더를 고릅니다.</li>
    <li>툴바의 퍼즐 조각 아이콘에서 planning-web 옆 📌을 눌러 고정합니다.</li>
    <li>아이콘이나 <kbd>Alt</kbd>+<kbd>S</kbd>로 패널을 엽니다. 이 사이트에 로그인해 두었다면 패널도 같은 계정으로 자동 로그인돼요.</li>
  </ol>
  <p class="note">설치하면 아무 페이지에서나 <b>오른쪽 클릭 → 「planning-web에 할 일로 추가」</b>도 쓸 수 있어요.
    글자를 골라 놓고 누르면 그 글자가 할 일 이름이 되고, 주소는 메모에 함께 남습니다. 저장은 패널에서 <kbd>Enter</kbd>로 합니다.</p>
  <p class="note">학교·회사 크롬북처럼 관리되는 기기에서 「blocked by policy」가 뜨면 관리자에게
    <a href="/extension.html" target="_blank">확장 프로그램 소개 페이지</a>를 보여 주고 허용을 요청하세요.</p>
  <p class="note">새 버전이 나오면 패널 위에 「새 버전이 있어요」 띠가 뜹니다. 그때 다시 내려받아 같은 폴더에 덮어쓰고,
    확장 프로그램 화면에서 🔄를 누르면 됩니다. (학교 크롬북처럼 관리자가 설치한 경우에는 저절로 올라갑니다.)</p>
  <form method="dialog"><button class="primary">닫기</button></form>`;
document.body.append(dialog);

dialog.querySelector('.copy').addEventListener('click', async (e) => {
  try {
    await navigator.clipboard.writeText('chrome://extensions');
    e.target.textContent = '복사됨 ✓';
  } catch {
    e.target.textContent = '직접 입력해 주세요';
  }
});

export function openInstallGuide() {
  dialog.showModal();
}
