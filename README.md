# 오늘 뭐 먹지? — 메뉴 추천 돌림판

메뉴를 고르기 어려울 때 사용할 수 있는 반응형 웹 돌림판입니다.  
HTML, CSS, JavaScript와 Canvas API만 사용했으며 별도의 설치나 서버 없이 실행할 수 있습니다.

<!-- GitHub Pages 배포 후 아래 주석을 해제하고 YOUR_GITHUB_ID를 본인 계정명으로 바꾸세요.
[웹에서 실행하기](https://YOUR_GITHUB_ID.github.io/menu-wheel/)
-->

<p align="center">
  <img src="./assets/menu-wheel-preview.png" alt="메뉴 추천 돌림판 전체 화면" width="720" />
</p>

## 프로젝트 소개

사용자가 메뉴를 직접 추가하고 관리한 뒤, 돌림판을 회전해 오늘의 식사 메뉴를 추천받는 웹 애플리케이션입니다. 단순 랜덤 추천뿐 아니라 직전 결과 제외, 당첨 메뉴 제거, 전체 메뉴 순환 추천을 지원합니다.

## 주요 기능

- 최대 16개 메뉴 추가·수정·삭제
- 드래그 및 화살표 버튼을 이용한 메뉴 순서 변경
- 한식·중식·일식·양식·배달·야식·간식 프리셋
- 일반 랜덤, 직전 결과 제외, 당첨 메뉴 제거, 전체 메뉴 순환 방식
- 추천 결과 복사, 지도 검색, 배달 검색
- LocalStorage를 이용한 메뉴와 설정 자동 저장
- 고해상도 디스플레이에 대응하는 Canvas 렌더링
- 모바일·태블릿·데스크톱 반응형 레이아웃
- 키보드 포커스 및 `prefers-reduced-motion` 접근성 대응

## 사용 기술

| 구분 | 기술 |
| --- | --- |
| 마크업 | HTML5 |
| 스타일 | CSS3, Responsive Web Design |
| 로직 | Vanilla JavaScript |
| 그래픽 | Canvas API |
| 저장 | Web Storage API — LocalStorage |
| 상호작용 | Drag and Drop API, Clipboard API |

## 핵심 구현

### Canvas 기반 돌림판

메뉴 개수에 따라 부채꼴의 각도와 텍스트 위치를 동적으로 계산해 Canvas에 그립니다. `devicePixelRatio`를 반영해 고해상도 화면에서도 선명하게 표시됩니다.

### 안정적인 회전 종료 처리

고정된 타이머 대신 `transitionend` 이벤트를 기준으로 결과를 확정합니다. 동작 줄이기 설정이 활성화된 환경에서는 불필요한 대기 없이 결과를 표시합니다.

### 추첨 방식 관리

- `일반 랜덤`: 모든 메뉴를 같은 확률로 추천
- `직전 결과 제외`: 직전에 나온 메뉴를 다음 추첨에서 제외
- `당첨 메뉴 자동 제거`: 추천된 메뉴를 목록에서 제거
- `전체 메뉴 1회씩 추천`: 모든 메뉴가 한 번씩 나오기 전까지 중복 없이 추천

### 데이터 검증 및 저장

저장된 데이터의 타입, 길이, 중복 여부를 검증하고 잘못된 값은 기본값으로 복구합니다. 브라우저 저장소 접근 실패도 예외 처리합니다.

## 폴더 구조

```text
menu-wheel/
├─ assets/
│  ├─ favicon.svg
│  ├─ menu-wheel-preview.png
│  └─ social-preview.png
├─ index.html
├─ style.css
├─ script.js
├─ README.md
├─ GITHUB_UPLOAD_GUIDE.md
├─ LICENSE
├─ .gitignore
└─ .nojekyll
```

## 실행 방법

### 바로 실행

저장소를 내려받은 뒤 `index.html`을 브라우저로 엽니다.

### 로컬 서버 실행

VS Code의 Live Server 확장 프로그램을 사용하거나 아래 명령을 실행합니다.

```bash
python -m http.server 5500
```

브라우저에서 `http://localhost:5500`으로 접속합니다.

## GitHub Pages 배포

업로드 및 배포 순서는 [`GITHUB_UPLOAD_GUIDE.md`](./GITHUB_UPLOAD_GUIDE.md)에 정리되어 있습니다.

## 지원 환경

최신 버전의 Chrome, Edge, Firefox, Safari를 권장합니다. Clipboard API 등 일부 기능은 브라우저 보안 정책에 따라 로컬 파일 실행보다 HTTPS 또는 로컬 서버 환경에서 더 안정적으로 작동합니다.

## 라이선스

이 프로젝트는 [MIT License](./LICENSE)를 따릅니다.
