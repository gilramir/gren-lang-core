/* `Bytes`'s host byte order (D499; geng-lang docs/m3-native.md §NA24): the
 * first of the two answers it is handed on a little-endian host. They are
 * handed as slots, since the row's type has a variable there (D515), and the
 * one chosen is answered as it came. */

#include "geng.h"

geng_cancel geng_core_bytes_hostEndianness(geng_slot little, geng_slot big, geng_wait *wait) {
    uint32_t one = 1;
    geng_succeed(wait, *(uint8_t *) &one == 1 ? little : big);
    return (geng_cancel) {0};
}
