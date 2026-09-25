%% `Migrate.check` (geng-lang m2-beam-toptier.md D458).
%%
%% Every reference to the row is replaced by the BEAM backend with the check
%% it generates at the reference's type, so this function is reached only if
%% the backend missed one, which is a compiler bug and not a value to keep.

-module(geng_core_migrate).
-export([check/2]).

-spec check(binary(), term()) -> no_return().
check(Where, _Term) ->
    erlang:error({geng_internal, <<"Migrate.check was called, not generated">>, Where}).
