/*

*/

// MATH

// `remainderBy` and `modBy` were here. They are `Integral`'s methods now, over
// `i32_rem`, with A3's zero rule and A11's Euclidean correction written in Geng
// in `Basics` — which is where the class is, so it is where the methods are
// (D145, `m1b-int.md` §I12).
//
// `modBy` is the one function in `core` that `_Debug_crash`ed on ordinary data:
// a zero modulus ended the program, in a language that advertises no runtime
// exceptions. A3 is the answer and `corpus/accept/int-mod-by-zero` is the fence.
// The crash is also why this file imported `Gren.Kernel.Debug`, and it no longer
// needs to.

// CONSTANTS

var _Math_pi = Math.PI;
var _Math_e = Math.E;
var _Math_maxSafeInteger = Number.MAX_SAFE_INTEGER;
var _Math_minSafeInteger = Number.MIN_SAFE_INTEGER;
var _Math_maxFloat = Number.MAX_VALUE;

// TRIGONOMETRY

var _Math_cos = Math.cos;
var _Math_sin = Math.sin;
var _Math_tan = Math.tan;
var _Math_acos = Math.acos;
var _Math_asin = Math.asin;
var _Math_atan = Math.atan;
var _Math_atan2 = F2(Math.atan2);

// MORE MATH

var _Math_truncate = Math.trunc;
var _Math_ceiling = Math.ceil;
var _Math_floor = Math.floor;
var _Math_round = Math.round;
var _Math_sqrt = Math.sqrt;
var _Math_log = Math.log;
var _Math_log10 = Math.log10;
