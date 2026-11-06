/* `Process.work` on Linux (geng-lang docs/m3-cost.md D754): the CPU time the
 * process has used, every thread's, in microseconds, which other programs on
 * the machine do not add to as they add to the wall clock (§CO12). */

#define _DEFAULT_SOURCE

#include <time.h>

#include "geng.h"

geng_cancel geng_core_process_work(void *build, void *adapter, geng_wait *wait) {
    struct timespec used;
    clock_gettime(CLOCK_PROCESS_CPUTIME_ID, &used);
    int64_t micros = (int64_t) used.tv_sec * 1000000 + used.tv_nsec / 1000;
    geng_succeed(wait, geng_call(build, adapter, (geng_slot[]) {geng_slot_I8(micros)}));
    return (geng_cancel) {0};
}
