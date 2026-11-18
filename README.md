# 닌포케카 · 닌도란 포켓몬 카드 게임 (NPCG, v0.1 기술 시험판)

모임(약 15명)끼리 브라우저에서 하는 포켓몬 카드 대전 사이트예요.

- **기본 룰만 사이트가 돕고, 카드 효과는 사람이 판정**해요. 기본 룰도 막지 않고 "이렇게 할까요?"로 제안하며, 다르게 하면 기록에 `사람 판정`으로 남아요.
- 상대는 사람 판정마다 **동의 / 이의 있음**을 누를 수 있고, 두 사람이 동의하면 그 판정 **바로 전으로 되돌려요**.
- 실시간과 **비동기**(결정마다 기한), **관전**(공개 정보만), **기보 다시 보기**(한 수씩, 차례 단위, 진행 중에도 내 시점으로)를 지원해요.
- 방을 만들어 시작하고, 한 사람이 여러 판을 동시에 가질 수 있어요.
- 카드 검색은 초성(ㅍㅋㅊ), 겹자모(ㄳ), 영문 자판(vzc), 입력 중 글자까지 찾아요.

## 구조

| 파일 | 하는 일 |
| --- | --- |
| `public/lib/engine.js` | 대전 엔진. 같은 시작값과 행동 목록이면 항상 같은 판 (기보·되돌리기·비동기의 바탕) |
| `public/lib/deck.js` | PTCGL 덱 리스트 읽기, 덱 규칙 검사 (60장, 같은 이름 4장, 기본 포켓몬, 에이스 스펙, H·I·J) |
| `public/lib/ks.js` | 한글 똑똑한 검색 |
| `src/worker.js` | Cloudflare Worker + Durable Objects (로비: 회원·덱·방 / 판마다 하나: 행동 기록, 숨긴 정보, 실시간 연결, 기한 알람) |
| `public/app.js` | 화면 |
| `tools/build-cards.py` | 카드 자료에서 `public/cards.json` 만들기 (저장소에는 넣지 않음) |
| `tools/build-cards-kr.py` | `public/cards.json`에 한글 이름·문장·그림 덧붙이기 (방법은 `tools/KR_CARDS.md`) |

카드 문장·그림 주소가 든 `public/cards.json`은 저작권 때문에 저장소에 올리지 않고 배포할 때 만들어요.

## 내 PC에서 돌려 보기

```bash
npm install
python3 tools/build-cards.py <cards_en.json> <sets_en.json> public/cards.json
# 카드 자료가 없으면 먼저: python3 tools/fetch-cards.py card-src  (공개 자료에서 받아요)
printf 'GROUP_CODE=모임코드\nSECRET=아무긴문자열\nADMINS=관리자이름\n' > .dev.vars
npx wrangler dev
node test/engine.test.js      # 엔진 시험
node test/e2e.cjs             # 두 사람 + 관전자 화면 시험 (Playwright)
```

Windows에서는 `tools\start-npcg.bat`(바탕화면 아이콘이 이걸 열어요)을 두 번 누르면 서버가 켜지고 PC 브라우저에 http://localhost:8787 이 열려요. 같은 와이파이의 폰은 `http://<PC 내부 IP>:8787`로 들어와요(방화벽에서 8787 포트를 같은 망에만 열어 두세요). 검은 창을 닫으면 꺼져요.

## 로그인과 전적

- 로그인은 닉네임 + 비밀번호. 처음 가입할 때만 모임 입장 코드(`GROUP_CODE`)를 넣어요. 비밀번호가 없던 예전 닉네임은 가입 칸에서 입장 코드와 새 비밀번호를 넣으면 그대로 이어 써요.
- 비밀번호는 PBKDF2(SHA-256, 10만 번)로 저장해요. 10분 안에 6번 틀리면 5분 쉬어요.
- 관리자: 설정 → 회원 관리에서 가입일, 마지막 접속, 로그인 기록(기기), 전적을 보고 비밀번호를 초기화해요(임시 비밀번호 → 들어오면 새 비밀번호를 정함). 비밀번호를 바꾸거나 초기화하면 다른 기기는 로그아웃돼요.
- 전적 탭: 모든 판의 승패·승률, 상대별 전적, 최근 대전(리플레이로 이동).
- `SECRET`(로그인 서명 열쇠)을 넣지 않으면 서버가 처음 한 번 무작위 열쇠를 만들어 저장해요. 그래도 배포 때는 넣어 두는 것을 권해요.

## 꾸미기와 관리자

- 설정에서 카드 뒷면·매트(기본 7종씩, 모두 자체 디자인)와 카드 그림을 고르고, 내 사진을 올려 뒷면·매트로 쓸 수 있어요. 고른 것은 계정에 저장돼요(소리 설정만 기기별).
- 각자 "모임 기본"을 고르면(처음 들어온 사람은 모두 이것) 관리자가 정한 모임 기본값을 따라가요.
- 관리자는 설정 맨 아래 "모임 기본값" 칸에서 모두의 기본 뒷면·매트·카드 그림을 정하고, 모임 사진을 올릴 수 있어요.
- 관리자: `.dev.vars`(배포 때는 `wrangler secret put ADMINS`)의 `ADMINS=이름1,이름2`. 없으면 맨 처음 가입한 사람이 관리자예요.
- 올린 사진은 휴대폰에서 줄여서(뒷면 440px, 매트 긴 쪽 1600px, WEBP) 로비 DB에 저장하고 `/api/img/<id>`로 보여 줘요. JPG·PNG·WEBP만, 1.5MB까지.
- 뒷면·매트 디자인을 바꾸려면 `python3 tools/make-skins.py`로 `public/skins.css`를 다시 만들어요.

## 배포 (Cloudflare 무료)

```bash
npx wrangler login
npx wrangler secret put GROUP_CODE
npx wrangler secret put SECRET
npx wrangler secret put ADMINS   # 관리자 이름 (쉼표로 여러 명)
npx wrangler deploy
```

## 아직 없는 것 (다음 단계)

- 실시간 판의 플레이어별 남은 시간, 카톡 알림
- 다면기 방, 3판 2선승 시간 종료 처리, 대회 대진 연결, 랭킹
- 영문 30th Celebration 카드 24장은 한글판과 다른 카드라 영문 이름으로 나옴 (한글 H·I·J 카드는 영문에 없는 한국판 카드까지 모두 들어 있음)
