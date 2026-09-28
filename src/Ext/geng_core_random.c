/* `Random`'s entropy (D499; geng-lang docs/m3-native.md §NA24): eight bytes
 * from the kernel's generator, as two `UInt32`s. */

#define _DEFAULT_SOURCE

#include <sys/random.h>

#include "geng.h"

geng_cancel geng_core_random_entropy(void *build, geng_wait *wait) {
    uint32_t words[2] = {0, 0};
    size_t got = 0;
    while (got < sizeof words) {
        ssize_t n = getrandom((char *) words + got, sizeof words - got, 0);
        if (n > 0) got += (size_t) n;
    }
    geng_succeed(wait, geng_slot_P(geng_call_I4I4(build, (int32_t) words[0], (int32_t) words[1])));
    return (geng_cancel) {0};
}
