/* `Random`'s entropy on Windows (D499; geng-lang docs/m4-windows.md §WN14):
 * eight bytes from the system's generator, as two `UInt32`s, through the
 * UCRT's `rand_s`, which asks the same generator `BCryptGenRandom` does and
 * needs no library linked. */

#define _CRT_RAND_S

#include <stdlib.h>

#include "geng.h"

geng_cancel geng_core_random_entropy(void *build, void *adapter, geng_wait *wait) {
    unsigned int words[2] = {0, 0};
    for (int k = 0; k < 2; k++)
        while (rand_s(&words[k]) != 0) {
        }
    geng_slot both[2] = {geng_slot_I4((int32_t) words[0]), geng_slot_I4((int32_t) words[1])};
    geng_succeed(wait, geng_call(build, adapter, both));
    return (geng_cancel) {0};
}
