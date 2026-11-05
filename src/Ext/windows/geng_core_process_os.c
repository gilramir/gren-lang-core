/* `Process.work` on Windows (geng-lang docs/m3-cost.md D754, m4-windows.md
 * §WN14): the CPU time the process has used, every thread's, in
 * microseconds: its user and kernel time, which `GetProcessTimes` counts in
 * 100 ns intervals. */

#define WIN32_LEAN_AND_MEAN

#include <windows.h>

#include "geng.h"

static int64_t ticks(FILETIME t) { return (int64_t) (((uint64_t) t.dwHighDateTime << 32) | t.dwLowDateTime); }

geng_cancel geng_core_process_work(void *build, void *adapter, geng_wait *wait) {
    FILETIME created, exited, kernel, user;
    int64_t micros = 0;
    if (GetProcessTimes(GetCurrentProcess(), &created, &exited, &kernel, &user))
        micros = (ticks(kernel) + ticks(user)) / 10;
    geng_succeed(wait, geng_call(build, adapter, (geng_slot[]) {geng_slot_I8(micros)}));
    return (geng_cancel) {0};
}
