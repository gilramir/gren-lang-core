%% Json's fast path for `decodeString` on the BEAM (m2-beam-toptier.md §TT50,
%% Dgmk3), as `Json.js` is JavaScript's (m1b-json.md §O16, D215, D222–D227):
%% OTP's `json:decode/3` reads the text, and its callbacks hand each value to
%% the Geng builder for its constructor, so the tree is the one `Json.Value`'s
%% own parser builds, and nothing here names a constructor (D192).
%%
%% It answers what the Geng parser answers on every input, and gives the text
%% back to it, by returning `NotFound`, wherever `json:decode` raises: a text
%% that is not JSON (the message is the Geng parser's, D217), and an escape
%% that is a lone surrogate, which OTP refuses and the Geng parser makes
%% U+FFFD (D209). A text with more than whitespace after its value is given
%% back too, so the Geng parser says where.
%%
%% What it does itself, as §O7 says:
%%   - an object's members in source order, a duplicate key keeping its last
%%     value at its first position (D213): `json`'s callbacks see the members
%%     in order, where its own maps would not;
%%   - a number read by `geng_prim:f64_from_decimal`, the Geng parser's own
%%     reading, so the correctly rounded double, `-0` and the overflows are
%%     its (D214): `json` hands each number over as its text.
%%
%% The builders arrive as the boundary makes them: `Object` a function of two
%% arguments, the keys and the values, each an `Array`; the others of one.
%% Only `json`'s own errors for a text that is not JSON are caught, so that a
%% fault here is a crash and not a quiet fall back to the slower parser.

-module(geng_core_json).
-export([parse_with/9, number/1, encode/2]).

parse_with(Nul, Bool, Number, Str, Arr, Object, Found, NotFound, Text) ->
    Decoders = #{
        null => Nul,
        float => fun(B) -> Number(decimal(B)) end,
        integer => fun(B) -> Number(integer(B)) end,
        array_start => fun(_) -> [] end,
        array_push => fun(V, Acc) -> [V | Acc] end,
        array_finish => fun(Acc, Old) -> {Arr(geng_prim:arr_from_list(lists:reverse([val(Bool, Str, V) || V <- Acc]))), Old} end,
        object_start => fun(_) -> [] end,
        object_push => fun(K, V, Acc) -> [{K, V} | Acc] end,
        object_finish => fun(Acc, Old) -> {object(Object, [{K, val(Bool, Str, V)} || {K, V} <- lists:reverse(Acc)]), Old} end
    },
    Flat = geng_prim:str_flat(Text),
    case minus_zero(Flat) of
        true -> NotFound;
        false -> decode(Flat, Decoders, Bool, Str, Found, NotFound)
    end.

decode(Flat, Decoders, Bool, Str, Found, NotFound) ->
    try json:decode(Flat, ok, Decoders) of
        {Value, ok, Rest} ->
            case whitespace(Rest) of
                true -> Found(val(Bool, Str, Value));
                false -> NotFound
            end
    catch
        error:{invalid_byte, _} -> NotFound;
        error:{unexpected_sequence, _} -> NotFound;
        error:unexpected_end -> NotFound
    end.

%% Does the text hold a `-0` that is not followed by a point or a digit? Such
%% a `-0` is a negative zero `json` would read as `0`. One followed by a
%% digit is no number (JSON has no leading zeros), but is common in a string,
%% a date's `2024-01`, so it does not count; one in a string followed by
%% something else gives the text back for nothing worse than the slower
%% parser.
minus_zero(Text) ->
    Pattern =
        case persistent_term:get({?MODULE, minus_zero}, undefined) of
            undefined ->
                {ok, P} = re:compile(<<"-0(?![0-9.])">>),
                persistent_term:put({?MODULE, minus_zero}, P),
                P;
            P ->
                P
        end,
    re:run(Text, Pattern, [{capture, none}]) =:= match.

%% A number as `geng_prim:f64_from_decimal` reads it, which is the Geng
%% parser's reading, but without its general path where the answer is the
%% same and cheaper: an integer of at most 15 digits is exact as a double,
%% and its double is `float/1`'s (a `-0` never arrives, `minus_zero/1`); a
%% float with a point and digits on both sides is what `binary_to_float`
%% reads, correctly rounded, which is also where `f64_from_decimal` ends after
%% normalising the text. Everything else, `1e5`, an overflow, a long integer,
%% takes the general path.
integer(B) when byte_size(B) =< 15 -> erlang:float(erlang:binary_to_integer(B));
integer(B) -> geng_prim:f64_from_decimal(B).

decimal(B) ->
    try erlang:binary_to_float(B)
    catch error:badarg -> geng_prim:f64_from_decimal(B)
    end.

%% `json` answers `true`, `false` and a string itself, and its `string`
%% callback would see keys too: each is made a `Value` where it lands, in an
%% array, an object or the top of the text. Everything else is a `Value`
%% already, from a builder.
val(Bool, _, true) -> Bool(true);
val(Bool, _, false) -> Bool(false);
val(_, Str, V) when is_binary(V) -> Str(V);
val(_, _, V) -> V.

object(Object, Pairs) ->
    Keys = [K || {K, _} <- Pairs],
    case length(lists:usort(Keys)) =:= length(Keys) of
        true ->
            Object(geng_prim:arr_from_list(Keys), geng_prim:arr_from_list([V || {_, V} <- Pairs]));
        false ->
            Last = maps:from_list(Pairs),
            Firsts = firsts(Keys, #{}, []),
            Object(geng_prim:arr_from_list(Firsts), geng_prim:arr_from_list([maps:get(K, Last) || K <- Firsts]))
    end.

firsts([], _, Acc) -> lists:reverse(Acc);
firsts([K | Ks], Seen, Acc) ->
    case Seen of
        #{K := _} -> firsts(Ks, Seen, Acc);
        _ -> firsts(Ks, Seen#{K => true}, [K | Acc])
    end.

whitespace(<<>>) -> true;
whitespace(<<C, Rest/binary>>) when C =:= $\s; C =:= $\t; C =:= $\n; C =:= $\r -> whitespace(Rest);
whitespace(_) -> false.

%% `Json.Value.number`: ECMAScript's `Number::toString` over the shortest
%% digits, as `JSON.stringify` writes them, in the body's steps: `null` for
%% NaN and the infinities, `0` for both zeros, an integer below 2^31 as one,
%% and otherwise the digits laid out by where the point falls (`n`), with an
%% exponent past 21 places or before 7.
number(F) when not is_float(F) -> <<"null">>;
number(F) when F == 0 -> <<"0">>;
number(F) when abs(F) < 2147483648.0, F == trunc(F) -> erlang:integer_to_binary(trunc(F));
number(F) ->
    %% OTP's shortest text without an exponent is already the layout, its
    %% point within 21 places of the start and 7 of a leading zero (OTP writes
    %% the exponent wherever that is shorter, which it always is outside), but
    %% for a `.0` that ECMAScript leaves off.
    Text = erlang:float_to_binary(F, [short]),
    case binary:match(Text, <<"e">>) of
        nomatch ->
            case binary:longest_common_suffix([Text, <<".0">>]) of
                2 -> binary:part(Text, 0, byte_size(Text) - 2);
                _ -> Text
            end;
        _ ->
            laid_out(F)
    end.

laid_out(F) ->
    Sign = case F < 0 of true -> <<"-">>; false -> <<>> end,
    {Ds, Exponent} = shortest(abs(F)),
    K = byte_size(Ds),
    N = Exponent + 1,
    if
        K =< N, N =< 21 ->
            <<Sign/binary, Ds/binary, (binary:copy(<<"0">>, N - K))/binary>>;
        0 < N, N =< 21 ->
            <<Sign/binary, (binary:part(Ds, 0, N))/binary, ".", (binary:part(Ds, N, K - N))/binary>>;
        -6 < N, N =< 0 ->
            <<Sign/binary, "0.", (binary:copy(<<"0">>, -N))/binary, Ds/binary>>;
        true ->
            Expo = case N - 1 < 0 of
                true -> <<"-", (erlang:integer_to_binary(1 - N))/binary>>;
                false -> <<"+", (erlang:integer_to_binary(N - 1))/binary>>
            end,
            case K of
                1 -> <<Sign/binary, Ds/binary, "e", Expo/binary>>;
                _ -> <<Sign/binary, (binary:part(Ds, 0, 1))/binary, ".", (binary:part(Ds, 1, K - 1))/binary, "e", Expo/binary>>
            end
    end.

%% The shortest digits and the exponent of the first, as
%% `geng_core_string:shortest_digits/1` answers them, without the text.
shortest(F) ->
    Text = erlang:float_to_binary(F, [short]),
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
    Ds = strip_trailing_zeros(binary:part(All, Lead, byte_size(All) - Lead)),
    {Ds, byte_size(Int) - 1 - Lead + Exp}.

leading_zeros(<<"0", Rest/binary>>, N) -> leading_zeros(Rest, N + 1);
leading_zeros(_, N) -> N.

strip_trailing_zeros(B) ->
    case B of
        <<>> -> <<>>;
        _ ->
            case binary:last(B) of
                $0 -> strip_trailing_zeros(binary:part(B, 0, byte_size(B) - 1));
                _ -> B
            end
    end.

%% `Json.Value.encode` (Dgmk4): the body's text, `JSON.stringify`'s, from a
%% walk over the tree as D367 shapes it: `null`, `{bool, B}`, `{number, F}`,
%% `{str, S}`, `{arr, Array}`, `{obj, Array}` of `#{key, value}` maps.
%%   - Layout: `[`/`{`, then each element after a line break (none when
%%     `Indent` is below 1) and a comma between, then a line break at the
%%     outer depth and `]`/`}`; an empty one is `[]`/`{}`. The gap is `Indent`
%%     spaces, at most 10, and a key's colon has a space after it with one.
%%   - A string escapes `"`, `\`, and every character below U+0020: the five
%%     with a short escape as `\b \f \n \r \t`, the rest as `\u00xx`,
%%     lowercase. Everything else is written as it is.
%%   - A number is `number/1`'s.
encode(Indent, Value) ->
    Gap = binary:copy(<<" ">>, max(0, min(10, Indent))),
    iolist_to_binary(enc(Value, Gap, 0)).

enc(null, _, _) -> <<"null">>;
enc({bool, true}, _, _) -> <<"true">>;
enc({bool, false}, _, _) -> <<"false">>;
enc({number, F}, _, _) -> number(F);
enc({str, S}, _, _) -> string(geng_prim:str_flat(S));
enc({arr, A}, Gap, Depth) ->
    case geng_prim:arr_to_list(A) of
        [] -> <<"[]">>;
        Items ->
            Inner = line(Gap, Depth + 1),
            [$[, Inner, lists:join([$, | Inner], [enc(V, Gap, Depth + 1) || V <- Items]), line(Gap, Depth), $]]
    end;
enc({obj, A}, Gap, Depth) ->
    case geng_prim:arr_to_list(A) of
        [] -> <<"{}">>;
        Pairs ->
            Inner = line(Gap, Depth + 1),
            Colon = case Gap of <<>> -> <<":">>; _ -> <<": ">> end,
            [${, Inner,
             lists:join([$, | Inner],
                        [[string(geng_prim:str_flat(K)), Colon, enc(V, Gap, Depth + 1)] || #{key := K, value := V} <- Pairs]),
             line(Gap, Depth), $}]
    end.

line(<<>>, _) -> <<>>;
line(Gap, Depth) -> [$\n | lists:duplicate(Depth, Gap)].

%% A string is written whole when nothing in it needs an escape, which is
%% nearly always; otherwise byte by byte, the bytes of a multi-byte character
%% all at or above 0x80 and so written as they are.
string(S) ->
    case binary:match(S, escaped()) of
        nomatch -> [$", S, $"];
        _ -> [$", escape(S, 0, 0, S), $"]
    end.

escaped() ->
    case persistent_term:get({?MODULE, escaped}, undefined) of
        undefined ->
            P = binary:compile_pattern([<<"\"">>, <<"\\">> | [<<C>> || C <- lists:seq(0, 31)]]),
            persistent_term:put({?MODULE, escaped}, P),
            P;
        P ->
            P
    end.

%% `escape(Rest, Start, Length, Whole)`: the run of `Length` plain bytes from
%% `Start` is written as one slice of `Whole` when an escape or the end comes.
escape(<<>>, Start, Length, Whole) ->
    [binary:part(Whole, Start, Length)];
escape(<<C, Rest/binary>>, Start, Length, Whole) when C =:= $"; C =:= $\\; C < 16#20 ->
    [binary:part(Whole, Start, Length), short(C) | escape(Rest, Start + Length + 1, 0, Whole)];
escape(<<_, Rest/binary>>, Start, Length, Whole) ->
    escape(Rest, Start, Length + 1, Whole).

short($") -> <<"\\\"">>;
short($\\) -> <<"\\\\">>;
short($\n) -> <<"\\n">>;
short($\r) -> <<"\\r">>;
short($\t) -> <<"\\t">>;
short($\b) -> <<"\\b">>;
short($\f) -> <<"\\f">>;
short(C) -> iolist_to_binary(io_lib:format("\\u00~2.16.0b", [C])).
