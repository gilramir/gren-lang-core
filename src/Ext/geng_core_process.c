/* `Process.sleep` (D499; geng-lang docs/m3-native.md §NA24): a timer on the
 * runtime's heap (D495), which the wait's cancel stops. A delay that is not a
 * positive number is none, and an infinite one never fires, as the Erlang
 * row's `delay_ms` has them. */

#include <math.h>

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
