/*

import Time exposing (customZone, Name, Offset)
import Gren.Kernel.Scheduler exposing (binding, succeed)

*/

function _Time_now(millisToPosix) {
  return __Scheduler_binding(function (callback) {
    // `Posix` holds an `Int64` since `int64-migration.md` M3, and D74 makes an
    // `Int64` a `BigInt` here. `Date.now()` is a Number, so the conversion is
    // written down rather than left to `millisToPosix` -- which cannot do it,
    // because in Core it is the identity.
    callback(__Scheduler_succeed(millisToPosix(BigInt(Date.now()))));
  });
}

var _Time_setInterval = F2(function (interval, task) {
  return __Scheduler_binding(function (callback) {
    var id = setInterval(function () {
      _Scheduler_rawSpawn(task);
    }, interval);
    return function () {
      clearInterval(id);
    };
  });
});

function _Time_here() {
  return __Scheduler_binding(function (callback) {
    callback(
      __Scheduler_succeed(
        A2(__Time_customZone, -new Date().getTimezoneOffset(), []),
      ),
    );
  });
}

function _Time_getZoneName() {
  return __Scheduler_binding(function (callback) {
    try {
      var name = __Time_Name(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch (e) {
      var name = __Time_Offset(new Date().getTimezoneOffset());
    }
    callback(__Scheduler_succeed(name));
  });
}
