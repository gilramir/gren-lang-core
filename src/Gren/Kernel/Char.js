/*

import Gren.Kernel.Utils exposing (chr)

*/

function _Char_toCode(char) {
  return char.codePointAt(0);
}

function _Char_fromCode(code) {
  return __Utils_chr(String.fromCodePoint(code));
}

// `Eq Char` (D142, `docs/m1b-classes.md` §G40). A `Char` is a one-character
// string, and `_Utils_chr__DEBUG` boxes it in a `String` object so that
// `Debug.toString` can tell one from a `String` — so `===` is reference
// equality on two distinct boxes in dev and is the right answer in prod.
// `Generate.CoreJS.Expression.kernelCall` writes the operator at a saturated
// call in either mode; these are what a reference to the name compiles to.
var _Char_identical__PROD = F2(function (a, b) {
  return a === b;
});

var _Char_identical__DEBUG = F2(function (a, b) {
  return a.valueOf() === b.valueOf();
});
