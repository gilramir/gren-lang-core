// Time's externs (m1b-extern.md §H8 step 6). `setInterval` runs a task again
// and again, which is a subscription, and stays kernel code until Source
// (item 4).

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
