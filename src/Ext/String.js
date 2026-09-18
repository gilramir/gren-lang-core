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
