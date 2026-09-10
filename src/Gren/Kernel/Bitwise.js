/*

*/

// `and`, `or`, `xor` and `complement` were here. They are `@prim`
// declarations in `Bitwise.gren` now (`core.md` C13, `m1b-int.md` §I10), which
// is `ffi.md` F7's plan for this file: it is deleted, one operation at a time,
// as the primitives that replace it become nameable. The three shifts wait on
// A4's shift-count clamp and A10's unsigned right shift, and
// `countLeadingZeros` is not a primitive at all.

var _Bitwise_countLeadingZeros = Math.clz32;

var _Bitwise_shiftLeftBy = F2(function (offset, a) {
  return a << offset;
});

var _Bitwise_shiftRightBy = F2(function (offset, a) {
  return a >> offset;
});

var _Bitwise_shiftRightZfBy = F2(function (offset, a) {
  return a >>> offset;
});
