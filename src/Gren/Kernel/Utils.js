/*

import Basics exposing (LT, EQ, GT)

*/

// EQUALITY

// `===`, which is what `Eq Int`, `Eq Float`, `Eq Bool` and `Eq String` are
// (D142, `docs/m1b-classes.md` §G40). `Generate.CoreJS.Expression.kernelCall`
// writes the operator at a saturated call, so this definition is what a
// reference to the name compiles to and not what a comparison costs.
//
// What was here was `_Utils_eq`: a loop with an explicit stack that read
// `typeof`, `Array.isArray` and a `for…in` at run time, plus a hand-written
// special case for `Dict` and for `Set` — which is what made this file import
// them. `==` is `Eq`'s method now, so a type's own instance says what it means,
// and there is nothing left for a walker to decide.
var _Utils_identical = F2(function (a, b) {
  return a === b;
});

// COMPARISONS

// Code in Generate/JavaScript.hs, Basics.js, and depends on
// the particular integer values assigned to LT, EQ, and GT.

// A `Char` used to need a case here: it was a one-character string that a dev
// build boxed in a `String` object, so `typeof x` was `"object"` and the
// comparison fell through to the array walk. A `Char` is a code point now
// (C8, `m1b-str.md` §T12) and a number takes the first branch, which is also
// why dev and release compare it the same way.
function _Utils_cmp(x, y) {
  if (typeof x !== "object") {
    return x === y ? /*EQ*/ 0 : x < y ? /*LT*/ -1 : /*GT*/ 1;
  }

  // At this point, we can only be comparing arrays
  for (var idx = 0; idx < x.length; idx++) {
    var ord = _Utils_cmp(x[idx], y[idx]);
    if (ord !== 0) return ord;
  }

  return x.length - y.length;
}

var _Utils_lt = F2(function (a, b) {
  return _Utils_cmp(a, b) < 0;
});
var _Utils_le = F2(function (a, b) {
  return _Utils_cmp(a, b) < 1;
});
var _Utils_gt = F2(function (a, b) {
  return _Utils_cmp(a, b) > 0;
});
var _Utils_ge = F2(function (a, b) {
  return _Utils_cmp(a, b) >= 0;
});

var _Utils_compare = F2(function (x, y) {
  var n = _Utils_cmp(x, y);
  return n < 0 ? __Basics_LT : n ? __Basics_GT : __Basics_EQ;
});

