/*

*/

// MATH

// `fdiv` and `idiv` were here, with `isNaN` and `isInfinite`. They are
// `Fractional`'s methods over `f64_div`, `f64_isnan` and `f64_isinf`, and
// `idiv` is `Integral`'s over `i32_div` with A3's zero guard in Geng in front
// of it (D145, `m1b-int.md` §I12). `add`, `sub`, `mul` and `negate` went the
// same way at D144. That is `ffi.md` F7's row for this file coming true one
// operation at a time.
//
// `pow` is the one arithmetic function left, and A9 is why it is not a
// primitive: V8, glibc, musl and Erlang already disagree in the last bits of
// `Math.pow`, so it is destined for the fdlibm port in Geng rather than for
// `Core.Prim`. `instance Num Float` calls this; `instance Num Int` does not —
// A7's rule is `powInt` in `Basics.gren`.

var _Basics_pow = F2(Math.pow);

// MORE MATH

function _Basics_toFloat(x) {
  return x;
}

// BOOLEANS

function _Basics_not(bool) {
  return !bool;
}
var _Basics_and = F2(function (a, b) {
  return a && b;
});
var _Basics_or = F2(function (a, b) {
  return a || b;
});
var _Basics_xor = F2(function (a, b) {
  return a !== b;
});
