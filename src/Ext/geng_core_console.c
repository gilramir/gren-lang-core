/* `Console`'s rows (D499, ffi.md F1; geng-lang docs/m3-native.md §NA24).
 *
 * Called as D193's convention in C: the arguments, then the wait, answered
 * through `geng_succeed`; nothing to cancel. The bytes are written as they
 * are, UTF-8, and standard output is flushed when the program ends. */

#include <stdio.h>

#include "geng.h"

geng_cancel geng_core_console_write(void *text, geng_wait *wait) {
    geng_bytes *t = text;
    if (t->length > 0) fwrite(t->data, 1, (size_t) t->length, stdout);
    geng_succeed(wait, geng_slot_U(0));
    return (geng_cancel) {0};
}

geng_cancel geng_core_console_writeErr(void *text, geng_wait *wait) {
    geng_bytes *t = text;
    fflush(stdout);
    if (t->length > 0) fwrite(t->data, 1, (size_t) t->length, stderr);
    geng_succeed(wait, geng_slot_U(0));
    return (geng_cancel) {0};
}
