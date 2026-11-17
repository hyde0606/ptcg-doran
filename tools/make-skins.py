# 카드 뒷면·매트 CSS 만들기 (모두 자체 디자인 SVG 를 data URI 로). 실행: python tools/make-skins.py [public/skins.css]
import random, urllib.parse, math, sys
random.seed(7)
def uri(svg):
    svg = ' '.join(svg.split())
    return 'url("data:image/svg+xml,' + urllib.parse.quote(svg, safe=" =:/,'-.()") + '")'

def emblem(band, face='#fff', acc=None, r=13):
    acc = acc or band
    return f'''<g transform="translate(31.5 44)"><circle r="{r+3.2}" fill="none" stroke="{face}" stroke-opacity=".35" stroke-width="1"/>
    <circle r="{r}" fill="{face}"/><circle r="{r}" fill="none" stroke="{band}" stroke-width="2.4"/>
    <rect x="-{r}" y="-1.5" width="{2*r}" height="3" fill="{band}"/>
    <circle r="{r*.38:.1f}" fill="{face}" stroke="{band}" stroke-width="2"/><circle r="{r*.15:.1f}" fill="{acc}"/></g>'''
def sparkle(x, y, s, c, o=1):
    return f'<path transform="translate({x} {y}) scale({s})" d="M0-4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1Z" fill="{c}" fill-opacity="{o}"/>'
def back(defs, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 88" preserveAspectRatio="xMidYMid slice"><defs>{defs}</defs>{body}</svg>'

backs = {}
# 링: 청록→파랑, 동심원 물결
rings = ''.join(f'<circle cx="31.5" cy="44" r="{r}" fill="none" stroke="#fff" stroke-opacity="{.22 - r*.0025:.3f}" stroke-width="1.2"/>' for r in range(19, 70, 6))
backs['ring'] = back('<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3fd1ae"/><stop offset="1" stop-color="#2a7fd6"/></linearGradient>',
    f'<rect width="63" height="88" fill="url(#g)"/>{rings}' + sparkle(12, 14, .9, '#fff', .8) + sparkle(52, 74, .7, '#fff', .7) + sparkle(50, 16, .5, '#fff', .6) + emblem('#1d5f86', acc='#38c6a0'))
# 밤하늘: 남색, 별
stars = ''.join(f'<circle cx="{random.uniform(2,61):.1f}" cy="{random.uniform(2,86):.1f}" r="{random.choice([.35,.5,.7]):.2f}" fill="#fff" fill-opacity="{random.uniform(.35,.95):.2f}"/>' for _ in range(46))
dots = ''.join(f'<circle cx="{31.5+21*math.cos(a/12*2*math.pi):.2f}" cy="{44+21*math.sin(a/12*2*math.pi):.2f}" r=".9" fill="#f2d49a" fill-opacity=".8"/>' for a in range(12))
backs['night'] = back('<radialGradient id="g" cx=".5" cy=".45" r=".75"><stop offset="0" stop-color="#34489a"/><stop offset="1" stop-color="#121a3d"/></radialGradient>',
    f'<rect width="63" height="88" fill="url(#g)"/>{stars}{dots}' + sparkle(10, 12, .9, '#f2d49a') + sparkle(54, 20, .6, '#f2d49a') + sparkle(14, 76, .6, '#f2d49a') + sparkle(50, 78, .8, '#f2d49a') + emblem('#b8892e', face='#fff8e6', acc='#f2d49a'))
# 숲: 초록, 잎
leaves = ''
for _ in range(26):
    x, y, a, s = random.uniform(0, 63), random.uniform(0, 88), random.uniform(0, 180), random.uniform(.7, 1.3)
    leaves += f'<g transform="translate({x:.1f} {y:.1f}) rotate({a:.0f}) scale({s:.2f})"><path d="M0-5 C3-3 3 3 0 5 C-3 3 -3-3 0-5Z" fill="#d9ffd9" fill-opacity=".22"/><path d="M0-4.5 L0 4.5" stroke="#ffffff" stroke-opacity=".25" stroke-width=".4"/></g>'
backs['leaf'] = back('<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fcf86"/><stop offset="1" stop-color="#2b8a57"/></linearGradient>',
    f'<rect width="63" height="88" fill="url(#g)"/>{leaves}' + emblem('#2a6a43', acc='#7fdc95'))
# 노을: 주황→분홍→보라, 햇살
rays = ''.join(f'<path d="M31.5 44 L{31.5+80*math.cos(math.radians(a)):.1f} {44+80*math.sin(math.radians(a)):.1f} L{31.5+80*math.cos(math.radians(a+9)):.1f} {44+80*math.sin(math.radians(a+9)):.1f}Z" fill="#fff" fill-opacity=".12"/>' for a in range(0, 360, 18))
backs['sunset'] = back('<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc061"/><stop offset=".55" stop-color="#ff7482"/><stop offset="1" stop-color="#9d5fd3"/></linearGradient>',
    f'<rect width="63" height="88" fill="url(#g)"/>{rays}' + emblem('#a8456f', acc='#ffb35c'))

# 바다: 파도 줄무늬
waves = ''.join(f'<path d="M-4 {y} q 8.5 -5 17 0 t 17 0 t 17 0 t 17 0 t 17 0" fill="none" stroke="#fff" stroke-opacity="{.10 + (i % 3) * .05:.2f}" stroke-width="1.6"/>' for i, y in enumerate(range(4, 92, 7)))
backs['sea'] = back('<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5cc8f0"/><stop offset="1" stop-color="#1f5fb8"/></linearGradient>',
    f'<rect width="63" height="88" fill="url(#g)"/>{waves}' + sparkle(13, 15, .7, '#fff', .8) + sparkle(51, 72, .6, '#fff', .7) + emblem('#174a8f', acc='#5cc8f0'))

# 불꽃: 빨강→주황, 위로 오르는 불꽃 무늬
random.seed(11)
flames = ''
for _ in range(16):
    x, y, s = random.uniform(0, 63), random.uniform(6, 92), random.uniform(.8, 1.6)
    flames += f'<path transform="translate({x:.1f} {y:.1f}) scale({s:.2f})" d="M0 0 C-4-3-3-8 0-12 C0-8 4-7 3-3 C5-5 5-8 4-10 C8-6 6 0 0 0Z" fill="#fff3c4" fill-opacity="{random.uniform(.12,.24):.2f}"/>'
backs['flame'] = back('<linearGradient id="g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffb347"/><stop offset=".5" stop-color="#ff6a3d"/><stop offset="1" stop-color="#c8283a"/></linearGradient>',
    f'<rect width="63" height="88" fill="url(#g)"/>{flames}' + sparkle(11, 13, .8, '#fff3c4', .85) + sparkle(52, 76, .7, '#fff3c4', .75) + emblem('#9c2233', acc='#ffb347'))

# 매트 무늬 (반복 타일)
def tile(w, h, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{body}</svg>'
cloud = lambda x, y, s, o: f'<g transform="translate({x} {y}) scale({s})" fill="#fff" fill-opacity="{o}"><ellipse cx="0" cy="0" rx="22" ry="9"/><ellipse cx="-10" cy="-6" rx="11" ry="9"/><ellipse cx="8" cy="-8" rx="13" ry="11"/></g>'
pat_sky = tile(320, 220, cloud(60, 50, 1, .55) + cloud(230, 120, 1.3, .45) + cloud(120, 185, .8, .5))
random.seed(3)
pat_night = tile(160, 160, ''.join(f'<circle cx="{random.uniform(0,160):.1f}" cy="{random.uniform(0,160):.1f}" r="{random.choice([.6,.9,1.3])}" fill="#fff" fill-opacity="{random.uniform(.3,.9):.2f}"/>' for _ in range(34))
    + ''.join(sparkle(random.uniform(10,150), random.uniform(10,150), 1.1, '#f2d49a', .7) for _ in range(3)))
pat_sand = tile(120, 120, ''.join(f'<circle cx="{random.uniform(0,120):.1f}" cy="{random.uniform(0,120):.1f}" r="{random.choice([.6,.9])}" fill="#b98a44" fill-opacity="{random.uniform(.12,.3):.2f}"/>' for _ in range(40))
    + '<path d="M0 100 Q30 92 60 100 T120 100" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>')
petal = lambda x, y, a, s: f'<path transform="translate({x:.0f} {y:.0f}) rotate({a:.0f}) scale({s:.2f})" d="M0 0 C4-6 10-4 8 2 C6 6 2 6 0 0Z" fill="#fff" fill-opacity=".55"/>'
flake = lambda x, y, s, o: f'<g transform="translate({x:.0f} {y:.0f}) scale({s:.2f})" stroke="#fff" stroke-opacity="{o:.2f}" stroke-width="1.4" stroke-linecap="round"><path d="M0-7V7M-6-3.5 6 3.5M-6 3.5 6-3.5M-2-5.5 0-3.5 2-5.5M-2 5.5 0 3.5 2 5.5"/></g>'
pat_snow = tile(200, 200, ''.join(flake(random.uniform(10,190), random.uniform(10,190), random.uniform(.7,1.3), random.uniform(.45,.8)) for _ in range(9)))
pat_sakura = tile(180, 180, ''.join(petal(random.uniform(0,180), random.uniform(0,180), random.uniform(0,360), random.uniform(.8,1.4)) for _ in range(12)))

css = ['/* ===== 카드 뒷면 고르기 (자체 디자인) ===== */']
css.append(':root { ' + ' '.join(f'--bk-{k}: {uri(svg)};' for k, svg in backs.items()) + ' }')
for k in backs:
    css.append(f'body.back-{k} .pc.back .cb {{ background: var(--bk-{k}) center / cover no-repeat; }}')
    css.append(f'.bk-{k} .cb {{ background: var(--bk-{k}) center / cover no-repeat !important; }}')
css.append('/* ===== 매트 고르기 (자체 디자인) ===== */')
mats = {
  'sky':    dict(bg=f'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,.5) 0, transparent 60%), {uri(pat_sky)} 0 0 / 320px 220px, linear-gradient(180deg, #92cdf3, #c6e8fd 48%, #c6e8fd 52%, #92cdf3)', edge='#d2e8f8', label='#23648f', labelbg='#eaf6ff', ink='#1e4f72', glow='rgba(30, 80, 130, .25)'),
  'night':  dict(bg=f'{uri(pat_night)} 0 0 / 160px 160px, radial-gradient(ellipse at 50% 50%, #3a4f9c 0, #1b2656 70%)', edge='#3b4a86', label='#f2d49a', labelbg='rgba(18, 26, 61, .9)', ink='#f3f6ff', glow='rgba(10, 16, 50, .45)', line='rgba(255,255,255,.45)', zone='rgba(255,255,255,.07)', empty='rgba(255,255,255,.45)', cnt='rgba(18, 26, 61, .9)'),
  'sand':   dict(bg=f'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,.5) 0, transparent 60%), {uri(pat_sand)} 0 0 / 120px 120px, linear-gradient(180deg, #ecd099, #f8e8c4 48%, #f8e8c4 52%, #ecd099)', edge='#efdcb4', label='#8a5a1c', labelbg='#fff6e3', ink='#6b4a1a', glow='rgba(120, 80, 30, .22)'),
  'sakura': dict(bg=f'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,.5) 0, transparent 60%), {uri(pat_sakura)} 0 0 / 180px 180px, linear-gradient(180deg, #f5bcd2, #fde0eb 48%, #fde0eb 52%, #f5bcd2)', edge='#f6d3e1', label='#a2456b', labelbg='#fff0f5', ink='#7a2f50', glow='rgba(140, 40, 90, .2)'),
}
maple = lambda x, y, a, s, c: f'<path transform="translate({x:.0f} {y:.0f}) rotate({a:.0f}) scale({s:.2f})" d="M0-9 L2-4 L6-6 L5-1 L9 0 L4 2 L5 6 L1 4 L0 9 L-1 4 L-5 6 L-4 2 L-9 0 L-5-1 L-6-6 L-2-4Z" fill="{c}" fill-opacity=".5"/>'
random.seed(5)
pat_autumn = tile(200, 200, ''.join(maple(random.uniform(0,200), random.uniform(0,200), random.uniform(0,360), random.uniform(.8,1.4), random.choice(['#ffffff', '#e8692f', '#d84a3a', '#f2a93b'])) for _ in range(11)))
mats['snow'] = dict(bg=f'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,.6) 0, transparent 60%), {uri(pat_snow)} 0 0 / 200px 200px, linear-gradient(180deg, #b9dcf0, #e6f4fc 48%, #e6f4fc 52%, #b9dcf0)', edge='#d6e9f5', label='#3a6f92', labelbg='#f2f9fe', ink='#2c5674', glow='rgba(40, 90, 130, .2)')
mats['autumn'] = dict(bg=f'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,.55) 0, transparent 60%), {uri(pat_autumn)} 0 0 / 200px 200px, linear-gradient(180deg, #f2c18c, #fbe4c6 48%, #fbe4c6 52%, #f2c18c)', edge='#f3d9bb', label='#9a4a1c', labelbg='#fff3e6', ink='#7a3a14', glow='rgba(140, 70, 20, .22)')
for k, m in mats.items():
    v = f"--m-bg: {m['bg']}; --m-edge: {m['edge']}; --m-label: {m['label']}; --m-labelbg: {m['labelbg']}; --m-ink: {m['ink']}; --m-glow: {m['glow']};"
    DEF = {'line': 'rgba(255,255,255,.75)', 'zone': 'rgba(255,255,255,.28)', 'empty': 'rgba(255,255,255,.8)', 'cnt': 'rgba(255,255,255,.9)'}
    for opt, var in (('line', '--m-line'), ('zone', '--m-zone'), ('empty', '--m-empty'), ('cnt', '--m-cnt')):
        v += f' {var}: {m.get(opt, DEF[opt])};'  # 미리 보기 칸이 다른 매트의 값을 물려받지 않게 모든 칸을 적는다
    css.append(f'body.mat-{k}, .mt-{k} {{ {v} }}')
open(sys.argv[1] if len(sys.argv) > 1 else 'public/skins.css', 'w', encoding='utf-8').write('\n'.join(css) + '\n')
print(sum(len(x) for x in css), 'bytes')
