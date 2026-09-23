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

%% OTP exposes no tz-database name -- its own time-zone support is the `TZ`
%% environment variable and nothing else -- but the *host* knows one, and so
%% does JavaScript's `Intl.DateTimeFormat().resolvedOptions().timeZone`, which
%% reads the same place. So this asks the host the three ways a Unix host
%% answers, in the order a Unix host means them, and falls back to the offset
%% when none of them says anything -- whose sign is the opposite of `here`'s,
%% because `ZoneName`'s documentation says it is `getTimezoneOffset()`'s.
%%
%% The fallback is not dead code waiting for a defect: it is what a host with
%% no zoneinfo answers, Windows among them, and `ZoneName` has the constructor
%% for exactly that reason.
getZoneName(Name, Offset, Succeed, _Fail) ->
    Succeed(case zone_name() of
                none -> Offset(-offset_minutes());
                Zone -> Name(Zone)
            end),
    none.

zone_name() ->
    case os:getenv("TZ") of
        false -> from_host();
        "" -> from_host();
        %% POSIX lets `TZ` carry a leading colon, and `:America/Chicago` names
        %% the same zone as `America/Chicago`.
        [$: | Zone] -> unicode:characters_to_binary(Zone, utf8);
        Zone -> unicode:characters_to_binary(Zone, utf8)
    end.

%% `/etc/localtime` is a symlink into the zoneinfo tree on most Unix hosts and
%% `/etc/timezone` is a one-line file on Debian's; either names the zone.
from_host() ->
    case file:read_link("/etc/localtime") of
        {ok, Path} -> after_zoneinfo(Path);
        _ ->
            case file:read_file("/etc/timezone") of
                {ok, Bin} -> first_line(Bin);
                _ -> none
            end
    end.

after_zoneinfo(Path) ->
    Bin = unicode:characters_to_binary(Path, utf8),
    case binary:match(Bin, <<"zoneinfo/">>) of
        nomatch -> none;
        {At, Len} -> binary:part(Bin, At + Len, byte_size(Bin) - At - Len)
    end.

first_line(Bin) ->
    case string:trim(hd(binary:split(Bin, <<"\n">>))) of
        <<>> -> none;
        Line -> Line
    end.

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

%% The ticker ends when it is cancelled or when its source has ended, which
%% `emit` answers `closed` for (D430): a source ends with the tree that owns
%% it, so a timer left running in a server's state stops when the server does,
%% rather than filling a queue nobody can read (geng-lang m2-interop.md §EI27.2).
tick(Ms, Emit, Build) ->
    receive
        cancel -> ok
    after Ms ->
        case Emit(Build(os:system_time(millisecond))) of
            closed -> ok;
            _ -> tick(Ms, Emit, Build)
        end
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
