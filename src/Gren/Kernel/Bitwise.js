/*

*/

// `and`, `or`, `xor` and `complement` were here, and as of D145 so were the
// three shifts. All seven are `Bits`' methods over `@prim` declarations in
// `Bitwise.gren` (`core.md` C13, `m1b-int.md` §I10 and §I12), which is
// `ffi.md` F7's plan for this file: it is deleted, one operation at a time, as
// the primitives that replace it become nameable.
//
// `countLeadingZeros` is what is left and is not a primitive at all. C13's rule
// admits an operation on a type whose representation the backend owns, and this
// one qualifies, but `Core.Prim` has no entry for it and nothing has needed one:
// `Math.clz32` is the intrinsics rule working as intended.

var _Bitwise_countLeadingZeros = Math.clz32;
