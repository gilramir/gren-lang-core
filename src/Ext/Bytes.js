// Bytes's two externs (m1b-bytes-prim.md D231, D234). Everything else in
// `Bytes`, `Bytes.Decode` and `Bytes.Encode` is Geng over the `bytes_` and
// `bt_` primitives (D233).

// Not `new Uint8Array(new Uint32Array([1]))[0]`, which was the kernel's: that
// copies the element 1 into a byte, which is 1 on every host, so it answered LE
// on a big-endian one too. The byte order is in the buffer.
function hostEndianness(le, be, succeed, fail) {
  succeed(new Uint8Array(new Uint32Array([1]).buffer)[0] === 1 ? le : be);
}

// A decode that exhausts the stack answers `exhausted` (D231). V8 reports an
// exhausted stack as a `RangeError`, and so does nothing else a decode can
// reach now that a read checks its bounds, but the message is what tells them
// apart, as the kernel did (m1b-protobuf.md §Q14.2). Anything else is rethrown.
function guard(run, input, exhausted) {
  try {
    return run(input);
  } catch (e) {
    if (e instanceof RangeError && /call stack/i.test(e.message)) {
      return exhausted;
    }
    throw e;
  }
}
