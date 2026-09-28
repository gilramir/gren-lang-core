/* `Bytes`'s host byte order (D499; geng-lang docs/m3-native.md §NA24): the
 * first of the two answers it is handed on a little-endian host. */

#include "geng.h"

geng_cancel geng_core_bytes_hostEndianness(int32_t little, int32_t big, geng_wait *wait) {
    uint32_t one = 1;
    geng_succeed(wait, geng_slot_I4(*(uint8_t *) &one == 1 ? little : big));
    return (geng_cancel) {0};
}
