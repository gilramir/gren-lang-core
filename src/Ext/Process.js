// Process's extern (m1b-extern.md §H8 step 6). `spawn` and `kill` are the
// scheduler's and stay kernel code.

function sleep(time, succeed, fail) {
  var id = setTimeout(function () {
    succeed();
  }, time);

  return function () {
    clearTimeout(id);
  };
}
