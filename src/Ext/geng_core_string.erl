%% String's one extern on the BEAM: `split`, an `@externPure` with a Geng body,
%% which every other backend compiles (D222). The Geng body is a loop over
%% `str_find` and `str_slice` into an `Array.Builder`; on the BEAM that is 22
%% times `binary:split`, most of it the builder under collection
%% (m2-beam-toptier.md §TT14.3, D446).
%%
%% `binary:split` is a byte search, and that is D160's rule on UTF-8 for the
%% reason `geng_prim`'s `str_find` gives: a separator is a `String`, so it
%% starts on a lead byte and cannot match inside a character. It keeps empty
%% pieces, as the Geng body does. An empty separator is a character each, as
%% the body's `foldl` over `fromChar` is (D209).

-module(geng_core_string).
-export([split/2]).

split(<<>>, String) ->
    erlang:list_to_tuple([<<C/utf8>> || <<C/utf8>> <= String]);
split(Separator, String) ->
    erlang:list_to_tuple(binary:split(String, Separator, [global])).
