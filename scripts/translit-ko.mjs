// Rule-based Hangul transcription for names with no established Korean form
// (mostly small Aboriginal Australian and Native American groups). It follows the broad
// lines of the Korean loanword rules: open syllables, ㄴ/ㅁ/ㅇ/ㄹ codas, other final
// consonants with ㅡ (ㅣ after sh/ch/j).
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const syl = (c, v, t = '') => String.fromCharCode(0xac00 + (CHO.indexOf(c) * 21 + JUNG.indexOf(v)) * 28 + JONG.indexOf(t));

// consonant phoneme -> initial jamo
const ONSET = { b: 'ㅂ', d: 'ㄷ', f: 'ㅍ', g: 'ㄱ', h: 'ㅎ', j: 'ㅈ', k: 'ㅋ', l: 'ㄹ', m: 'ㅁ', n: 'ㄴ', p: 'ㅍ', r: 'ㄹ', s: 'ㅅ', t: 'ㅌ', v: 'ㅂ', z: 'ㅈ', ch: 'ㅊ', sh: 'ㅅ', th: 'ㅅ', ng: 'ㅇ', '': 'ㅇ' };
const VOW = { a: 'ㅏ', e: 'ㅔ', i: 'ㅣ', o: 'ㅗ', u: 'ㅜ', eu: 'ㅡ' };
// glides: y+V, w+V
const YV = { a: 'ㅑ', e: 'ㅖ', i: 'ㅣ', o: 'ㅛ', u: 'ㅠ' };
const WV = { a: 'ㅘ', e: 'ㅞ', i: 'ㅟ', o: 'ㅝ', u: 'ㅜ' };

function phonemes(word) {
  let w = word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’'ʻ]/g, '');
  w = w.replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/qu/g, 'kw').replace(/q/g, 'k').replace(/x/g, 'ks').replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k');
  w = w.replace(/tj/g, 'ch').replace(/dj/g, 'j').replace(/dh/g, 'd').replace(/rr/g, 'r').replace(/ll/g, 'l').replace(/([bdfgkmnpstvz])\1/g, '$1');
  w = w.replace(/aa/g, 'a').replace(/ii/g, 'i').replace(/uu/g, 'u').replace(/ee|ea/g, 'i').replace(/oo|ou/g, 'u').replace(/ai/g, 'aI').replace(/ay|ei|ey/g, 'eI').replace(/au|aw/g, 'aU').replace(/oe/g, 'o');
  const out = [];
  for (let i = 0; i < w.length;) {
    const two = w.slice(i, i + 2);
    if (['ch', 'sh', 'th', 'ng', 'kh', 'gh', 'zh', 'ny'].includes(two)) {
      if (two === 'kh' || two === 'gh') out.push({ c: two[0] === 'k' ? 'k' : 'g' });
      else if (two === 'zh') out.push({ c: 'j' });
      else if (two === 'ny') { out.push({ c: 'n' }); out.push({ g: 'y' }); }
      else out.push({ c: two });
      i += 2; continue;
    }
    const ch = w[i];
    if (ch === 'I') { out.push({ v: 'i' }); i++; continue; }
    if (ch === 'U') { out.push({ v: 'u' }); i++; continue; }
    if ('aeiou'.includes(ch)) { out.push({ v: ch }); i++; continue; }
    if (ch === 'y') { if ('aeiou'.includes(w[i + 1] ?? '') && !(out.at(-1)?.g)) out.push({ g: 'y' }); else out.push({ v: 'i' }); i++; continue; }
    if (ch === 'w') { if ('aeiou'.includes(w[i + 1] ?? '')) out.push({ g: 'w' }); else out.push({ v: 'u' }); i++; continue; }
    if (ONSET[ch]) out.push({ c: ch });
    i++;
  }
  return out;
}

export function transliterate(word) {
  const ph = phonemes(word);
  let res = '';
  for (let i = 0; i < ph.length; i++) {
    const p = ph[i];
    if (p.v) { res += syl('ㅇ', VOW[p.v]); continue; }
    // onset (+glide) + vowel
    let c = p.c ?? '', g = p.g ?? null, j = i + 1;
    if (p.c && ph[j]?.g) { g = ph[j].g; j++; }
    const v = ph[j]?.v;
    if (v) {
      let vowel = g === 'y' ? YV[v] : g === 'w' ? WV[v] : VOW[v];
      let ini = ONSET[c] ?? 'ㅇ';
      if (c === 'sh') vowel = { a: 'ㅑ', e: 'ㅖ', i: 'ㅣ', o: 'ㅛ', u: 'ㅠ' }[v];
      if (c === 'ng' && res === '') { res += '응'; ini = 'ㄱ'; }
      // intervocalic l doubles (말레이)
      if (c === 'l' && res && /[\uac00-\ud7a3]$/.test(res)) { const last = res.charCodeAt(res.length - 1) - 0xac00; if (last % 28 === 0) res = res.slice(0, -1) + String.fromCharCode(res.charCodeAt(res.length - 1) + 8); }
      // coda + next: skip if previous syllable already took this sound
      res += syl(ini, vowel);
      // diphthong tail
      i = j;
      continue;
    }
    // consonant without following vowel: coda or ㅡ syllable
    const last = res.length ? res.charCodeAt(res.length - 1) - 0xac00 : -1;
    const open = last >= 0 && last % 28 === 0;
    const coda = { n: 'ㄴ', m: 'ㅁ', ng: 'ㅇ', l: 'ㄹ' }[c];
    if (coda && open) { res = res.slice(0, -1) + String.fromCharCode(res.charCodeAt(res.length - 1) + JONG.indexOf(coda)); continue; }
    if (c === 'k' && open && i === ph.length - 1) { res = res.slice(0, -1) + String.fromCharCode(res.charCodeAt(res.length - 1) + JONG.indexOf('ㄱ')); continue; }
    if (!c) continue;
    const iv = ['sh', 'ch', 'j'].includes(c) ? 'ㅣ' : 'ㅡ';
    res += syl(ONSET[c], iv);
  }
  return res;
}
