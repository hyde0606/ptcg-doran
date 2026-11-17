// 한글 똑똑한 검색: 초성, 겹자모, 영문 자판, 입력 중 글자
const KS = (() => {
  const CH = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ", JU = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
  const JO = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
  const SPLIT = {"ㄳ":"ㄱㅅ","ㄵ":"ㄴㅈ","ㄶ":"ㄴㅎ","ㄺ":"ㄹㄱ","ㄻ":"ㄹㅁ","ㄼ":"ㄹㅂ","ㄽ":"ㄹㅅ","ㄾ":"ㄹㅌ","ㄿ":"ㄹㅍ","ㅀ":"ㄹㅎ","ㅄ":"ㅂㅅ",
    "ㅘ":"ㅗㅏ","ㅙ":"ㅗㅐ","ㅚ":"ㅗㅣ","ㅝ":"ㅜㅓ","ㅞ":"ㅜㅔ","ㅟ":"ㅜㅣ","ㅢ":"ㅡㅣ"};
  const JOIN = {}; for(const [k,v] of Object.entries(SPLIT)) JOIN[v] = k;
  const KEY = {q:"ㅂ",w:"ㅈ",e:"ㄷ",r:"ㄱ",t:"ㅅ",y:"ㅛ",u:"ㅕ",i:"ㅑ",o:"ㅐ",p:"ㅔ",a:"ㅁ",s:"ㄴ",d:"ㅇ",f:"ㄹ",g:"ㅎ",h:"ㅗ",j:"ㅓ",k:"ㅏ",l:"ㅣ",
    z:"ㅋ",x:"ㅌ",c:"ㅊ",v:"ㅍ",b:"ㅠ",n:"ㅜ",m:"ㅡ",Q:"ㅃ",W:"ㅉ",E:"ㄸ",R:"ㄲ",T:"ㅆ",O:"ㅒ",P:"ㅖ"};
  const isV = c => JU.includes(c), isC = c => CH.includes(c);
  const norm = q => q.toLowerCase().replace(/[^0-9a-z가-힣ㄱ-ㅣ]/g, "");
  const split = c => SPLIT[c] || c;
  function jamo(s){ let o = ""; for(const ch of s){ const c = ch.charCodeAt(0) - 0xAC00;
    if(c >= 0 && c < 11172) o += CH[Math.floor(c/588)] + split(JU[Math.floor(c%588/28)]) + split(JO[c%28]); else o += split(ch); } return o; }
  function units(s){ const u = []; for(const ch of s){ const c = ch.charCodeAt(0) - 0xAC00;
    if(c >= 0 && c < 11172) u.push({s:ch, c:CH[Math.floor(c/588)], j:jamo(ch)});
    else if(SPLIT[ch] && isC(SPLIT[ch][0])) for(const x of SPLIT[ch]) u.push({c:x});
    else if(isC(ch)) u.push({c:ch}); else u.push({o:ch}); } return u; }
  function compose(js){ // single jamo -> text, like a Korean IME
    let out = "", i = 0;
    while(i < js.length){
      const ci = CH.indexOf(js[i]);
      if(ci < 0 || !isV(js[i+1])){ out += js[i++]; continue; }
      let v = js[i+1], k = i + 2;
      if(isV(js[k]) && JOIN[v + js[k]]){ v = JOIN[v + js[k]]; k++; }
      let t = "";
      if(JO.indexOf(js[k]) > 0 && !isV(js[k+1])){ t = js[k++]; if(JOIN[t + js[k]] && JO.includes(JOIN[t + js[k]]) && !isV(js[k+1])) t = JOIN[t + js[k++]]; }
      out += String.fromCharCode(0xAC00 + (ci*21 + JU.indexOf(v))*28 + JO.indexOf(t)); i = k;
    }
    return out;
  }
  const fromKeys = q => compose([...q].map(ch => KEY[ch] || KEY[ch.toLowerCase()] || ch));
  function unitAt(n, q){
    outer: for(let s = 0; s + q.length <= n.length; s++){
      for(let i = 0; i < q.length; i++){
        const a = q[i], b = n[s+i];
        if(a.s){ if(!b.s || (b.s !== a.s && !(i === q.length-1 && b.j.startsWith(a.j)))) continue outer; }
        else if(a.c){ if(b.c !== a.c) continue outer; }
        else if(b.o !== a.o) continue outer;
      }
      return s;
    }
    return -1;
  }
  // matcher(query) returns (koNormalized, enNormalized, cacheObject) => rank (lower is better) or -1
  function matcher(raw){
    const cands = [];
    const add = (t, w) => { t = norm(t); if(t && !cands.some(c => c.t === t)) cands.push({t, w, j:jamo(t), u:units(t)}); };
    add(raw, 0);
    if(/[A-Za-z]/.test(raw)){ add(fromKeys(raw), 2); add(fromKeys(raw.toLowerCase()), 2); }
    return (ko, en, cache) => {
      cache.j ??= jamo(ko); cache.u ??= units(ko);
      let best = -1;
      for(const c of cands){
        let p = cache.j.indexOf(c.j); if(p < 0) p = unitAt(cache.u, c.u);
        if(p < 0 && c.w === 0) p = en.indexOf(c.t);
        if(p >= 0){ const r = c.w + (p > 0 ? 1 : 0); if(best < 0 || r < best) best = r; }
      }
      return best;
    };
  }
  return {matcher, norm, fromKeys};
})();
export default KS;
