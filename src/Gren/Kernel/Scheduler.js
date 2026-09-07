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

function _Scheduler_concurrent(tasks) {
  if (tasks.length === 0) return _Scheduler_succeed([]);

  return _Scheduler_binding(function (callback) {
    let count = 0;
    let results = new Array(tasks.length);
    let procs;

    function killAll() {
      procs.forEach(_Scheduler_rawKill);
    }

    function onError(e) {
      killAll();
      callback(_Scheduler_fail(e));
    }

    procs = tasks.map((task, i) => {
      function onSuccess(res) {
        results[i] = res;
        count++;
        if (count === tasks.length) {
          callback(_Scheduler_succeed(results));
        }
      }
      const success = A2(_Scheduler_andThen, onSuccess, task);
      const handled = A2(_Scheduler_onError, onError, success);
      return _Scheduler_rawSpawn(handled);
    });

    return killAll;
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
    _Scheduler_rawKill(proc);

    callback(_Scheduler_succeed({}));
  });
}

function _Scheduler_rawKill(proc) {
  var task = proc.__root;
  if (task && task.$ === __1_BINDING && task.__kill) {
    task.__kill();
  }

  // Everything the process was going to do next is abandoned — except its
  // release handlers, which are exactly what cancellation must still run. They
  // live in the process's own state rather than in the interpreter's call
  // stack, which is what makes reaching them here possible at all, and the
  // frames are already in innermost-first order. Each is taken as it is found,
  // so that killing an already-killed process releases nothing twice.
  var releases = [];
  for (var frame = proc.__stack; frame; frame = frame.__rest) {
    if (frame.$ === __1_RELEASE && frame.__release) {
      releases.push(frame.__release);
      frame.__release = null;
    }
  }

  // `__root` is the only field a kill may clear. `rawKill` is reachable from
  // inside a callback that `_Scheduler_step` is part-way through running — a
  // task of a `concurrent` fails, and the failure handler kills its siblings
  // and itself — and that callback's caller still reads `__stack` afterwards.
  proc.__root = null;

  if (releases.length === 0) {
    return;
  }

  // A process of their own, because the one that owned them is dead: it is the
  // handle a scheduler that waits for a cancelled child would wait on.
  var chain = releases[0]();
  for (var i = 1; i < releases.length; i++) {
    chain = A2(_Scheduler_andThen, _Scheduler_releaseThunk(releases[i]), chain);
  }
  _Scheduler_rawSpawn(chain);
}

function _Scheduler_releaseThunk(release) {
  return function (_) {
    return release();
  };
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
