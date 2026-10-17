/* `Process.sleep` (D499; geng-lang docs/m3-native.md §NA24): a timer on the
 * runtime's heap (D495), which the wait's cancel stops. A delay that is not a
 * positive number is none, and an infinite one never fires, as the Erlang
 * row's `delay_ms` has them. */

#define _DEFAULT_SOURCE

#include <math.h>
#include <time.h>

#include "geng.h"

static void wake(void *wait) { geng_succeed(wait, geng_slot_U(0)); }

static geng_task *stop(void *timer) {
    geng_timer_cancel(timer);
    return NULL;
}

geng_cancel geng_core_process_sleep(double ms, geng_wait *wait) {
    if (isinf(ms) && ms > 0) return (geng_cancel) {0};
    geng_timer *t = geng_timer_start(ms > 0 ? ms : 0, wake, wait);
    return (geng_cancel) {stop, t};
}

/* `Process.work` (geng-lang docs/m3-cost.md D754): the CPU time the process
 * has used, every thread's, in microseconds, which other programs on the
 * machine do not add to as they add to the wall clock (§CO12). */
geng_cancel geng_core_process_work(void *build, geng_wait *wait) {
    struct timespec used;
    clock_gettime(CLOCK_PROCESS_CPUTIME_ID, &used);
    int64_t micros = (int64_t) used.tv_sec * 1000000 + used.tv_nsec / 1000;
    geng_succeed(wait, geng_slot_P(geng_call_I8(build, micros)));
    return (geng_cancel) {0};
}
