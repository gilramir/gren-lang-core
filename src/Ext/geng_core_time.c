/* `Time`'s rows (D499; geng-lang docs/m3-native.md §NA24), as the Erlang row
 * answers them: the wall clock in milliseconds, and `every` a repeating timer
 * that emits into its source until cancelled or the source is closed. The
 * monotonic clock, the local offset and the zone's name ask the system, and
 * are each platform's (`linux/`, `windows/`; geng-lang docs/m4-windows.md
 * §WN14). */

#include <math.h>

#include "geng.h"

geng_cancel geng_core_time_now(void *build, void *adapter, geng_wait *wait) {
    geng_succeed(wait, geng_call(build, adapter, (geng_slot[]) {geng_slot_I8(geng_now_wall())}));
    return (geng_cancel) {0};
}

typedef struct {
    double interval;
    void *source;
    void *build;
    /* Static, the program's, so not a pointer the collector follows. */
    void *adapter;
    geng_timer *timer;
    int stopped;
} ticker;

static void tick(void *env) {
    ticker *t = env;
    if (t->stopped) return;
    if (!geng_source_emit(t->source, geng_call(t->build, t->adapter, (geng_slot[]) {geng_slot_I8(geng_now_wall())}))) {
        t->stopped = 1;
        return;
    }
    t->timer = geng_timer_start(t->interval, tick, t);
    geng_write_barrier(t, &t->timer, t->timer);
}

geng_cancel geng_core_time_every(double interval, void *source, void *build, void *adapter, geng_wait *wait) {
    ticker *t = geng_alloc(sizeof *t, GENG_HEADER_WORDS(ticker) | GENG_HEADER_POINTER(ticker, source) |
                                          GENG_HEADER_POINTER(ticker, build) | GENG_HEADER_POINTER(ticker, timer));
    t->interval = interval > 0 && !isinf(interval) ? round(interval) : 0;
    t->source = source;
    t->build = build;
    t->adapter = adapter;
    t->stopped = 0;
    t->timer = geng_timer_start(t->interval, tick, t);
    geng_succeed(wait, geng_slot_P(t));
    return (geng_cancel) {0};
}

geng_cancel geng_core_time_cancel(void *handle, geng_wait *wait) {
    ticker *t = handle;
    t->stopped = 1;
    geng_timer_cancel(t->timer);
    geng_succeed(wait, geng_slot_U(0));
    return (geng_cancel) {0};
}
