// Console's externs (portable-core.md P1, P9; geng-lang m1b-source.md §SO13).
//
// On node the task completes in the write's callback rather than after the
// call, since a write to a pipe is asynchronous on POSIX: completing early would
// let a program end with its last lines still queued. The callback is also
// where a failed write lands, and it is ignored, because `Console` cannot fail.
//
// Without `process`, in a browser, the console is the only place text can go.
// It is line-oriented and adds its own line break, so one trailing newline is
// dropped rather than printed as an empty line.

function write(text, succeed, fail) {
  put(typeof process !== "undefined" && process.stdout, console.log, text, succeed);
}

function writeErr(text, succeed, fail) {
  put(typeof process !== "undefined" && process.stderr, console.error, text, succeed);
}

function put(stream, log, text, succeed) {
  if (stream) {
    stream.write(text, function () {
      succeed({});
    });
    return;
  }
  log(text.endsWith("\n") ? text.slice(0, -1) : text);
  succeed({});
}
