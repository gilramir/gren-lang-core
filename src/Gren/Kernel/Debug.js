/*

*/

// LOG

// `Debug.log` renders in Gren now (D158), so what arrives here is the finished
// line rather than a value: `inspect` has already been applied and the tag
// joined on. That is what lets `core.md` C13's `debug_log` be a primitive
// every backend can answer with a `console.log`, rather than one that obliges
// each of them to walk a value.
var _Debug_log__PROD = F2(function (line, value) {
  return value;
});

var _Debug_log__DEBUG = F2(function (line, value) {
  console.log(line);
  return value;
});

// TODOS
//
// `Debug.todo` is not here any more: the lowering makes each one an `ECrash
// Todo` carrying where it was written and its message, and the backend's
// `_Crash_todo` throws (D335, geng-lang `m1a-lowering.md` §L4). `_Debug_todo`
// took a module name and a region that stock's code generator filled in and
// this one never did, so it answered a function instead of crashing
// (`m1b-extern.md` §H18.4). `_Debug_todoCase` and `_Debug_crash`, which only it
// reached, went with it.

// TO STRING
//
// The untyped value walker that was here is gone (D410, geng-lang
// `m2-interop.md` §EI18.5). `Debug.toString` had gone before it (D16, §G45):
// `inspect` replaced it, typed, total and pinned by `docs/representation.md`
// R5. Its last caller was `geng repl`'s printer, and D410 deleted the REPL
// (D69: there is no REPL).
