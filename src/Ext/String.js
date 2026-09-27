// `String.split` and `String.shortestDigits` on JavaScript.

// `String.split` (D484, geng-lang `pre-m3-js.md` §JS8): JavaScript's own, as
// stock Gren's kernel had it, 3.4 times faster than the Geng body on node.
// `split` works on UTF-16 code units, and that is right for a non-empty
// separator because a `String` holds no lone surrogate (D209): the separator
// begins and ends on a whole codepoint, so it cannot match half of a pair, and
// every piece is whole codepoints too. The empty separator is the case units
// get wrong -- `"😀".split("")` is two surrogates, core#163 -- so it answers
// `Array.from`, which walks codepoints. `accept/string-split-astral` holds both
// to the Geng body, which `geng-hs-bodies` runs.
function split(sep, string) {
  return sep === "" ? Array.from(string) : string.split(sep);
}

// `String.shortestDigits` on JavaScript (D328, geng-lang `m1b-ryu.md` §Y16).
//
// `toExponential()` with no argument is ECMA-262's Number::toString digits —
// the shortest that read back as the number — laid out as `d.ddde±x`. The Geng
// body answers Ryu's digits as `ddddex`, so this drops the point and the plus
// sign and leaves the rest: `1.5e-7` becomes `15e-7`, `1e+21` becomes `1e21`.
// The caller has already handled the sign, zero, infinities and NaN.
//
// Where the specification leaves the last digit open, V8 and SpiderMonkey
// agree with Ryu on every case §Y16.2 found; the `geng-hs-bodies` target and
// `accept/float-shortest-digits` hold that to the corpus.
function shortestDigits(x) {
  return Math.abs(x).toExponential().replace(".", "").replace("+", "");
}
