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
