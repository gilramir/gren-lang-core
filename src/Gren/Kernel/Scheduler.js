/*

*/

// TASKS

function _Scheduler_succeed(value) {
  return {
    $: __1_SUCCEED,
    __value: value,
  };
}

function _Scheduler_fail(error) {
  return {
    $: __1_FAIL,
    __value: error,
  };
}

function _Scheduler_binding(callback) {
  return {
    $: __1_BINDING,
    __callback: callback,
    __kill: null,
  };
}

var _Scheduler_andThen = F2(function (callback, task) {
  return {
    $: __1_AND_THEN,
    __callback: callback,
    __task: task,
  };
});

var _Scheduler_onError = F2(function (callback, task) {
  return {
    $: __1_ON_ERROR,
    __callback: callback,
    __task: task,
  };
});

function _Scheduler_receive(callback) {
  return {
    $: __1_RECEIVE,
    __callback: callback,
  };
}

// `bracket` cannot be written on `andThen` and `onError`, because those two
// only see a task that finished. A cancelled task does not finish: `rawKill`
// below drops the process's stack, and with it every release handler a library
// implementation would have parked there. So the release handler is a third
// kind of stack frame, which the interpreter answers to on success, on failure
// and on cancellation alike.
var _Scheduler_bracket = F3(function (acquire, release, use) {
  return A2(
    _Scheduler_andThen,
    function (resource) {
      return {
        $: __1_BRACKET,
        __release: function () {
          return release(resource);
        },
        __task: use(resource),
      };
    },
    acquire
  );
});

// Run one release handler, then carry the outcome that reached it on unchanged.
// The handler is a `Task Never {}`, so the outcome cannot be lost to a second
// failure on the way out.
function _Scheduler_releasing(frame, outcome) {
  return A2(
    _Scheduler_andThen,
    function (_) {
      return outcome;
    },
    frame.__release()
  );
}

// CANCELLATION IS SOMETHING TO WAIT FOR
//
// Cancelling a task is not instantaneous: what it leaves to do is the release
// handlers of every `bracket` it interrupted. So `rawKill` hands back a task —
// null if there is nothing left — and each of its callers waits for it rather
// than merely starting it. That is what lets `concurrent` keep the promise
// `portable-core.md` P2 makes for it, and what orders an outer release handler
// after the inner ones when both are cancelled at once.
//
// The steps are thunks, because a release handler builds its task when it runs.

function _Scheduler_inOrder(steps) {
  if (steps.length === 0) {
    return null;
  }

  var chain = steps[0]();
  for (var i = 1; i < steps.length; i++) {
    chain = A2(_Scheduler_andThen, _Scheduler_thenRun(steps[i]), chain);
  }

  return chain;
}

function _Scheduler_thenRun(step) {
  return function (_) {
    return step();
  };
}

function _Scheduler_always(task) {
  return function () {
    return task;
  };
}

// A scope with a fixed child set. `concurrent` and `race` are both one, and
// they differ in a single question: what a child *succeeding* means. Failure is
// the same for both — §N9.3's first failure cancels the siblings and fails the
// scope — and so is everything below it, which is why this is one function.
//
// `makeAnswer` is called once per run, not once per task value: a `Task` is a
// value and may be run twice, so the counting a `concurrent` does cannot live
// out here.
function _Scheduler_scope(tasks, makeAnswer) {
  return _Scheduler_binding(function (callback) {
    const answer = makeAnswer();
    let procs;
    // An outcome has been chosen; and, separately, nobody is listening for one
    // any more because this task was itself cancelled.
    let settled = false;
    let abandoned = false;

    // Cancel every task and hand back what those cancellations have left to
    // do. Killing a process that already finished takes nothing and returns
    // nothing, so this is also how the successful siblings are disposed of.
    function cancelAll() {
      const steps = [];
      for (let i = 0; i < procs.length; i++) {
        const pending = _Scheduler_rawKill(procs[i]);
        if (pending) {
          steps.push(_Scheduler_always(pending));
        }
      }
      return _Scheduler_inOrder(steps);
    }

    // The first failure cancels the siblings — and this task does not answer
    // until they are finished, release handlers included. `concurrent` is
    // specified as a scope with a fixed child set (`portable-core.md` P2), and
    // a scope does not complete before its children do
    // (`concurrency-native.md` §N9.3).
    function settle(outcome) {
      if (settled || abandoned) {
        return;
      }
      settled = true;

      const pending = cancelAll();
      if (!pending) {
        callback(outcome);
        return;
      }

      _Scheduler_rawSpawn(
        A2(
          _Scheduler_andThen,
          function (_) {
            if (!abandoned) {
              callback(outcome);
            }
            return _Scheduler_succeed({});
          },
          pending
        )
      );
    }

    procs = tasks.map((task, i) => {
      function onSuccess(res) {
        // Null means "not yet": a `concurrent` still waiting on a sibling.
        const outcome = answer(i, res);
        if (outcome) {
          settle(outcome);
        }
      }
      function onError(e) {
        settle(_Scheduler_fail(e));
      }
      const success = A2(_Scheduler_andThen, onSuccess, task);
      const handled = A2(_Scheduler_onError, onError, success);
      return _Scheduler_rawSpawn(handled);
    });

    // Cancelled from outside: no answer is owed any more, but the children
    // still have to be finished with, and whoever did the killing waits.
    return function () {
      abandoned = true;
      return cancelAll();
    };
  });
}

function _Scheduler_concurrent(tasks) {
  if (tasks.length === 0) return _Scheduler_succeed([]);

  return _Scheduler_scope(tasks, function () {
    const results = new Array(tasks.length);
    let count = 0;

    return function (i, res) {
      results[i] = res;
      count++;
      return count === tasks.length ? _Scheduler_succeed(results) : null;
    };
  });
}

// The first child to *settle* is the answer, and settling means succeeding or
// failing: the branch that wins a `race [ work, timeout ]` is the one that
// fails, so a `race` that waited for a success could never time out. `Task`'s
// `race` takes a task and an array rather than an array, so `tasks` is never
// empty here and this always has an answer to give.
function _Scheduler_race(tasks) {
  return _Scheduler_scope(tasks, function () {
    return function (i, res) {
      return _Scheduler_succeed(res);
    };
  });
}

var _Scheduler_map2 = F3(function (callback, taskA, taskB) {
  function combine([resA, resB]) {
    return _Scheduler_succeed(A2(callback, resA, resB));
  }
  return A2(_Scheduler_andThen, combine, _Scheduler_concurrent([taskA, taskB]));
});

// PROCESSES

var _Scheduler_guid = 0;

function _Scheduler_rawSpawn(task) {
  var proc = {
    $: __2_PROCESS,
    __id: _Scheduler_guid++,
    __root: task,
    __stack: null,
    __mailbox: [],
  };

  _Scheduler_enqueue(proc);

  return proc;
}

function _Scheduler_spawn(task) {
  return _Scheduler_binding(function (callback) {
    callback(_Scheduler_succeed(_Scheduler_rawSpawn(task)));
  });
}

function _Scheduler_rawSend(proc, msg) {
  proc.__mailbox.push(msg);
  _Scheduler_enqueue(proc);
}

var _Scheduler_send = F2(function (proc, msg) {
  return _Scheduler_binding(function (callback) {
    _Scheduler_rawSend(proc, msg);
    callback(_Scheduler_succeed({}));
  });
});

function _Scheduler_kill(proc) {
  return _Scheduler_binding(function (callback) {
    var pending = _Scheduler_rawKill(proc);

    if (!pending) {
      callback(_Scheduler_succeed({}));
      return;
    }

    // `kill` answers when the cancellation is finished rather than when it is
    // started, which is the difference between a release handler being a
    // guarantee and being a hope.
    _Scheduler_rawSpawn(
      A2(
        _Scheduler_andThen,
        function (_) {
          callback(_Scheduler_succeed({}));
          return _Scheduler_succeed({});
        },
        pending
      )
    );
  });
}

// Returns what this cancellation has left to do, or null if it is finished.
// The caller waits for it: `_Scheduler_kill` and `concurrent`'s `cancelAll`
// are the two, and neither may merely start it.
function _Scheduler_rawKill(proc) {
  var steps = [];

  var task = proc.__root;
  if (task && task.$ === __1_BINDING && task.__kill) {
    // A kill function returns nothing, or the task its *own* cancellation has
    // left to do. `concurrent`'s below is the only one that returns anything:
    // the other ten in `core` and `node` are a `clearTimeout`, a
    // `clearInterval`, an `abort`, a `close`, two `kill`s and four `off`s, and
    // every one of them answers `undefined`. It is sequenced first, so an
    // inner scope is finished with before this process's own handlers run:
    // innermost-first holds across a `concurrent` as well as within one.
    var pending = task.__kill();
    if (pending) {
      steps.push(_Scheduler_always(pending));
    }
  }

  // Everything the process was going to do next is abandoned — except its
  // release handlers, which are exactly what cancellation must still run. They
  // live in the process's own state rather than in the interpreter's call
  // stack, which is what makes reaching them here possible at all, and the
  // frames are already in innermost-first order. Each is taken as it is found,
  // so that killing an already-killed process releases nothing twice.
  for (var frame = proc.__stack; frame; frame = frame.__rest) {
    if (frame.$ === __1_RELEASE && frame.__release) {
      steps.push(frame.__release);
      frame.__release = null;
    }
  }

  // `__root` is the only field a kill may clear. `rawKill` is reachable from
  // inside a callback that `_Scheduler_step` is part-way through running — a
  // task of a `concurrent` fails, and the failure handler kills its siblings
  // and itself — and that callback's caller still reads `__stack` afterwards.
  proc.__root = null;

  return _Scheduler_inOrder(steps);
}

/* STEP PROCESSES

type alias Process =
  { $ : tag
  , id : unique_id
  , root : Task
  , stack : null | { $: SUCCEED | FAIL, a: callback, b: stack }
                 | { $: RELEASE, a: () -> Task Never {}, b: stack }
  , mailbox : [msg]
  }

*/

var _Scheduler_working = false;
var _Scheduler_queue = [];

function _Scheduler_enqueue(proc) {
  _Scheduler_queue.push(proc);
  if (_Scheduler_working) {
    return;
  }
  _Scheduler_working = true;
  // Make sure tasks created during _step are run
  while (_Scheduler_queue.length > 0) {
    const activeProcs = _Scheduler_queue;
    _Scheduler_queue = [];

    for (const proc of activeProcs) {
      _Scheduler_step(proc);
    }
  }
  _Scheduler_working = false;
}

function _Scheduler_step(proc) {
  stepping: while (proc.__root) {
    var rootTag = proc.__root.$;
    if (rootTag === __1_SUCCEED || rootTag === __1_FAIL) {
      while (proc.__stack && proc.__stack.$ !== rootTag) {
        // A release frame matches neither tag, so it is reached on both, which
        // is the whole of what `bracket` promises about success and failure.
        if (proc.__stack.$ === __1_RELEASE) {
          proc.__root = _Scheduler_releasing(proc.__stack, proc.__root);
          proc.__stack = proc.__stack.__rest;
          continue stepping;
        }
        proc.__stack = proc.__stack.__rest;
      }
      if (!proc.__stack) {
        return;
      }
      proc.__root = proc.__stack.__callback(proc.__root.__value);
      proc.__stack = proc.__stack.__rest;
    } else if (rootTag === __1_BINDING) {
      proc.__root.__kill = proc.__root.__callback(function (newRoot) {
        proc.__root = newRoot;
        _Scheduler_enqueue(proc);
      });
      return;
    } else if (rootTag === __1_BRACKET) {
      proc.__stack = {
        $: __1_RELEASE,
        __release: proc.__root.__release,
        __rest: proc.__stack,
      };
      proc.__root = proc.__root.__task;
    } else if (rootTag === __1_RECEIVE) {
      if (proc.__mailbox.length === 0) {
        return;
      }
      proc.__root = proc.__root.__callback(proc.__mailbox.shift());
    } // if (rootTag === __1_AND_THEN || rootTag === __1_ON_ERROR)
    else {
      proc.__stack = {
        $: rootTag === __1_AND_THEN ? __1_SUCCEED : __1_FAIL,
        __callback: proc.__root.__callback,
        __rest: proc.__stack,
      };
      proc.__root = proc.__root.__task;
    }
  }
}
