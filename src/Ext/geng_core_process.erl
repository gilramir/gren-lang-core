%% Process's one extern on the BEAM (m1b-extern.md §H8 step 6). `spawn` and
%% `kill` are the scheduler's, as the primitives `task_spawn` and `task_kill`
%% (D283), and are not here.
%%
%% This is the extern that shows the shape at its fullest: it answers later
%% rather than at once, and it returns a cancel function, so §E18.4's three
%% completions and §E18.5's cancellation all run through it.

-module(geng_core_process).
-export([sleep/3]).

%% The runtime's sleep, which a tree of one makes in place, a `receive`
%% with nothing else to wait on, and which is otherwise a timer process whose
%% cancel this answers (geng-lang m2-beam-toptier.md D470).
sleep(Ms, Succeed, _Fail) ->
    geng_rt:sleep(delay_ms(Ms), fun() -> Succeed({}) end).

%% A1 · a `Float` may be a sentinel. A sleep of infinity is one that never
%% answers, which a `receive` with no `after` is exactly.
delay_ms(Ms) when is_float(Ms), Ms > 0 -> round(Ms);
delay_ms(infinity) -> infinity;
delay_ms(_) -> 0.
