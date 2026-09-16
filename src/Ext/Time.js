// Time's externs (m1b-extern.md §H8 step 6; timers, m1b-source.md §SO15).

// `Posix` holds an `Int64` since `int64-migration.md` M3, and D74 makes an
// `Int64` a `BigInt`. `Date.now()` is a Number, so the conversion is written
// down here, where the kernel wrote it too.
function now(build, succeed, fail) {
  succeed(build(BigInt(Date.now())));
}

function here(build, succeed, fail) {
  succeed(build(-new Date().getTimezoneOffset()));
}

// The fallback's sign is the opposite of `here`'s. That is the kernel's, and
// `ZoneName`'s documentation shows it.
function getZoneName(name, offset, succeed, fail) {
  var zone;
  try {
    zone = name(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch (e) {
    zone = offset(new Date().getTimezoneOffset());
  }
  succeed(zone);
}

// Each tick emits the time it fired at into the caller's source (D71), built
// by the Geng function it is handed, as the effect manager read `now` when it
// delivered one.
function every(interval, ticks, build, succeed, fail) {
  var id = setInterval(function () {
    ticks.emit(build(BigInt(Date.now())));
  }, interval);
  succeed(id);
}

function cancel(id, succeed, fail) {
  clearInterval(id);
  succeed();
}
