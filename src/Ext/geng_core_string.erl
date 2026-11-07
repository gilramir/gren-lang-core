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
-export([split/2, shortest_digits/1]).

split(<<>>, String) ->
    erlang:list_to_tuple([<<C/utf8>> || <<C/utf8>> <= String]);
split(Separator, String) ->
    erlang:list_to_tuple(binary:split(String, Separator, [global])).

%% `shortestDigits` (D328, m1b-ryu.md §Y16): the shortest digits that read back
%% as the float and the decimal exponent of the first, `<digits>e<exponent>`,
%% no sign, point or trailing zero. OTP's `float_to_binary(F, [short])` is the
%% shortest round trip too, written as `1.5e-7`, `100.0` or `0.001`; this
%% rewrites it to the body's form (m2-beam-toptier.md §TT50, Dgmk3), where the
%% Geng body is Ryu over emulated 64-bit arithmetic, about 30 times slower.
shortest_digits(F) ->
    Text = erlang:float_to_binary(erlang:abs(F), [short]),
    {Mantissa, Exp} =
        case binary:split(Text, <<"e">>) of
            [M, E] -> {M, erlang:binary_to_integer(E)};
            [M] -> {M, 0}
        end,
    {Int, Frac} =
        case binary:split(Mantissa, <<".">>) of
            [I, Fr] -> {I, Fr};
            [I] -> {I, <<>>}
        end,
    All = <<Int/binary, Frac/binary>>,
    Lead = leading_zeros(All, 0),
    Digits = strip_trailing_zeros(binary:part(All, Lead, byte_size(All) - Lead)),
    Exponent = byte_size(Int) - 1 - Lead + Exp,
    <<Digits/binary, "e", (erlang:integer_to_binary(Exponent))/binary>>.

leading_zeros(<<"0", Rest/binary>>, N) -> leading_zeros(Rest, N + 1);
leading_zeros(_, N) -> N.

strip_trailing_zeros(<<>>) -> <<>>;
strip_trailing_zeros(B) ->
    case binary:last(B) of
        $0 -> strip_trailing_zeros(binary:part(B, 0, byte_size(B) - 1));
        _ -> B
    end.
