%% `Outbound.out` (geng-lang m2-interop.md D428).
%%
%% Every reference to the row is replaced by the BEAM backend with the
%% conversion it generates at the reference's type, so this function is
%% reached only if the backend missed one, which is a compiler bug.

-module(geng_core_outbound).
-export([out/1]).

-spec out(term()) -> no_return().
out(_Value) ->
    erlang:error({geng_internal, <<"Outbound.out was called, not generated">>}).
