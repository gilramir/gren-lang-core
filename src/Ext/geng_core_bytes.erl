%% Bytes's one extern on the BEAM (m1b-bytes-prim.md D231, D234). Everything
%% else in `Bytes`, `Bytes.Encode` and `Bytes.Decode` is Geng over the `bytes_`
%% and `bt_` primitives (D233), and `Bytes.Decode.guard` is an `@externPure`
%% with a Geng body, which every backend without a row compiles (D222).
%%
%% The byte order is read out of a buffer rather than out of a number, for the
%% reason the JavaScript file gives: converting the value 1 to a byte answers 1
%% on every host, big-endian ones included.

-module(geng_core_bytes).
-export([hostEndianness/4]).

hostEndianness(Le, Be, Succeed, _Fail) ->
    Succeed(case <<1:32/native>> of
                <<1, 0, 0, 0>> -> Le;
                _ -> Be
            end),
    none.
