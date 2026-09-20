%% Random's one extern on the BEAM (m1b-source.md §SO16): portable-core.md
%% P1's OS entropy, two whole 32-bit words that `Random.geng` makes a seed of.
%%
%% `crypto:strong_rand_bytes/1` is the OS CSPRNG and needs no application
%% started. `rand:bytes/1` would not do: P1 asks for the host's entropy, not
%% for a pseudo-random stream the BEAM seeded itself.

-module(geng_core_random).
-export([entropy/3]).

%% D194 · a Geng function crosses as a plain n-ary fun, so the two words are
%% one call and not a curried pair.
entropy(Build, Succeed, _Fail) ->
    <<A:32/unsigned, B:32/unsigned>> = crypto:strong_rand_bytes(8),
    Succeed(Build(A, B)),
    none.
