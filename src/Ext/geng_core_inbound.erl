%% `Inbound.check` (geng-lang m2-interop.md D422, §EI23).
%%
%% Every reference to the row is replaced by the BEAM backend with the check
%% it generates at the reference's type, so this function is reached only if
%% the backend missed one, which is a compiler bug and not a term to believe.

-module(geng_core_inbound).
-export([check/2]).

-spec check(binary(), term()) -> no_return().
check(Where, _Term) ->
    erlang:error({geng_internal, <<"Inbound.check was called, not generated">>, Where}).
