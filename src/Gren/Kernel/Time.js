/*

import Gren.Kernel.Scheduler exposing (binding, rawSpawn)

*/

// `now`, `here` and `getZoneName` are externs (src/Ext/Time.js). What is left
// runs a task on a timer, which is a subscription, and waits for Source.

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
