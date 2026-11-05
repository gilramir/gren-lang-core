/* `Random`'s entropy (D499; geng-lang docs/m3-native.md §NA24): eight bytes
 * from the kernel's generator, as two `UInt32`s. */

#define _DEFAULT_SOURCE

#include <sys/random.h>

#include "geng.h"

geng_cancel geng_core_random_entropy(void *build, void *adapter, geng_wait *wait) {
    uint32_t words[2] = {0, 0};
    size_t got = 0;
    while (got < sizeof words) {
        ssize_t n = getrandom((char *) words + got, sizeof words - got, 0);
        if (n > 0) got += (size_t) n;
    }
    geng_slot both[2] = {geng_slot_I4((int32_t) words[0]), geng_slot_I4((int32_t) words[1])};
    geng_succeed(wait, geng_call(build, adapter, both));
    return (geng_cancel) {0};
}
