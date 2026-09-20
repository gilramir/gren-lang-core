%% Console's externs on the BEAM (portable-core.md P1, P9; geng-lang
%% m2-beam.md §BM19.2).
%%
%% A Geng `String` is a UTF-8 binary, and `io:put_chars` on a device whose
%% encoding is `unicode` writes one through byte for byte — including an
%% astral-plane character and a NUL. `geng_rt:run_main` sets that encoding at
%% the start of every program, because the default is the locale's and a
%% `latin1` device would decode the binary and re-encode it, which loses
%% anything past U+00FF.
%%
%% `io:put_chars` is synchronous, so there is nothing queued to lose when the
%% program halts: 20 MB written and then `halt(0)` arrives whole through a
%% pipe, which is the BEAM's answer to §E18.7's flush. Node needed a write
%% callback for the same rule (m1b-source.md §SO12).
%%
%% `Console` cannot fail, so neither of these ever calls `Fail`, and neither
%% has anything to cancel.

-module(geng_core_console).
-export([write/3, writeErr/3]).

write(Text, Succeed, _Fail) ->
    io:put_chars(standard_io, Text),
    Succeed({}),
    none.

writeErr(Text, Succeed, _Fail) ->
    io:put_chars(standard_error, Text),
    Succeed({}),
    none.
