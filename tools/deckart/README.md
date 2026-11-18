# 덱 사진 인식 자료 만들기 (public/cardart.bin)

`public/cardart.bin`은 카드 그림마다 아주 작게 줄인 그림 칸(24x16)의 특징을 96개 숫자로 바꿔 둔 목록이에요. 카드 그림 자체는 들어 있지 않고, 저장소에도 넣지 않아요(.gitignore). PC에서 `npx wrangler deploy` 할 때 public/ 에 있으면 함께 올라가고, 로그인한 사람만 받을 수 있어요.

카드 자료(cards.json)가 바뀌면 다시 만들어요.
1. PC: `card-src/artdump.py` (= 이 폴더의 artdump.py) 실행 → `card-src/artdump.bin`, `artdump.json` (F:\AI\17_포켓몬 카드 의 한글판 SV·메가 시대 그림 전부 + 사이트 카드의 한글·영문 그림, 60x84로 줄임)
2. `buildlab.py`: 그림마다 사이트 카드 id 붙이기 (한글판은 같은 이름·기술이면 같은 카드, 사이트에 없으면 '!이름')
3. `mkindex.py`: 특징 → 96차원(PCA) int8 + 숫자 본보기 → `public/cardart.bin`

`deckscan.py`·`ident.py`는 브라우저 코드(`public/lib/deckscan.js`)와 같은 방법의 파이썬 시험판이에요. 경로는 만들 때 쓴 환경 기준이라 쓸 때 고쳐 주세요.
샘플(일본 공식 3, 아시아 공식, Limitless, 한국 공식, 코리안리그)에서 카드 칸·장수 모두 맞고, 틀린 '확실'은 0장이었어요.
