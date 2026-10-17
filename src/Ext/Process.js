// Process's extern (m1b-extern.md §H8 step 6). `spawn` and `kill` are the
// scheduler's, as the primitives task_spawn and task_kill (D283).

function sleep(time, succeed, fail) {
  var id = setTimeout(function () {
    succeed();
  }, time);

  return function () {
    clearTimeout(id);
  };
}

// `Process.work` (geng-lang m3-cost.md D754): the CPU time the process has
// used, user and system, in microseconds, where node has `process.cpuUsage`;
// in a browser the time since the page started, in microseconds. `Int64` is a
// `BigInt` (D74).
function work(build, succeed, fail) {
  var micros;
  if (typeof process !== "undefined" && typeof process.cpuUsage === "function") {
    var used = process.cpuUsage();
    micros = used.user + used.system;
  } else {
    micros = Math.round(performance.now() * 1000);
  }
  succeed(build(BigInt(micros)));
}
