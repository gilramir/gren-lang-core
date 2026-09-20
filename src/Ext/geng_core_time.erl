%% Time's externs on the BEAM (m1b-extern.md §H8 step 6; timers,
%% m1b-source.md §SO15; geng-lang m2-beam.md §BM19.2).
%%
%% D192 · Only the host's own types cross. A `Posix` and a `ZoneName` are Geng
%% values, so each of these is handed a Geng function that builds one and
%% answers what that function returned.

-module(geng_core_time).
-export([now/3, here/3, getZoneName/4, every/5, cancel/3]).

%% `Posix` holds an `Int64` (int64-migration.md M3), which on the BEAM is an
%% integer, so there is no conversion to write down as there is on JavaScript.
now(Build, Succeed, _Fail) ->
    Succeed(Build(os:system_time(millisecond))),
    none.

%% Minutes east of UTC, which is the sign JavaScript's `-getTimezoneOffset()`
%% gives. Erlang has no offset function, so it is the difference between the
%% two clocks, to the minute.
here(Build, Succeed, _Fail) ->
    Succeed(Build(offset_minutes())),
    none.

%% The BEAM has no tz-database name to ask for: OTP's own time-zone support is
%% the `TZ` environment variable and nothing else. So the name is `TZ` when the
%% environment sets one, and otherwise the offset, whose sign is the opposite
%% of `here`'s because `ZoneName`'s documentation says it is
%% `getTimezoneOffset()`'s.
getZoneName(Name, Offset, Succeed, _Fail) ->
    Succeed(case os:getenv("TZ") of
                false -> Offset(-offset_minutes());
                "" -> Offset(-offset_minutes());
                Zone -> Name(unicode:characters_to_binary(Zone, utf8))
            end),
    none.

%% Each tick emits the time it fired at into the caller's source (D71), built
%% by the Geng function this is handed. `Ticks` is F4's handle — the `emit` and
%% `close` an implementation may call, and not the source itself — so nothing
%% here names the runtime. The handle answers a `Handle`, which is opaque to
%% Geng and is the ticking process.
every(Interval, Ticks, Build, Succeed, _Fail) ->
    #{emit := Emit} = Ticks,
    Ms = interval_ms(Interval),
    Succeed(spawn(fun() -> tick(Ms, Emit, Build) end)),
    none.

cancel(Handle, Succeed, _Fail) ->
    Handle ! cancel,
    Succeed({}),
    none.

tick(Ms, Emit, Build) ->
    receive
        cancel -> ok
    after Ms ->
        Emit(Build(os:system_time(millisecond))),
        tick(Ms, Emit, Build)
    end.

%% A1 · a Geng `Float` is `float() | nan | infinity | neg_infinity`. A timer
%% cannot have a non-finite period, and `setInterval` treats one as nought, so
%% this does too rather than inventing a third behaviour.
interval_ms(Ms) when is_float(Ms), Ms > 0 -> round(Ms);
interval_ms(infinity) -> 0;
interval_ms(_) -> 0.

offset_minutes() ->
    Local = calendar:datetime_to_gregorian_seconds(calendar:local_time()),
    Utc = calendar:datetime_to_gregorian_seconds(calendar:universal_time()),
    (Local - Utc) div 60.
