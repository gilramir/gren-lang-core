/* `Console`'s rows on Windows (D499, ffi.md F1; geng-lang docs/m4-windows.md
 * §WN14, §WN20): the text written as Linux's rows write it, every byte,
 * unbuffered (D532), so what a program wrote is in the file or the pipe when
 * the task completes. Any failure drops the rest: `Console` cannot fail.
 *
 * The runtime's `geng_std_write` does the writing. A pipe or a file gets the
 * UTF-8 as it is; a console gets it as UTF-16, which shows it as written
 * whatever the console's code page (D1090). */

#include "geng.h"

geng_cancel geng_core_console_write(void *text, geng_wait *wait) {
    geng_bytes *t = text;
    geng_std_write(1, t->data, (size_t) t->length);
    geng_succeed(wait, geng_slot_U(0));
    return (geng_cancel) {0};
}

geng_cancel geng_core_console_writeErr(void *text, geng_wait *wait) {
    geng_bytes *t = text;
    geng_std_write(2, t->data, (size_t) t->length);
    geng_succeed(wait, geng_slot_U(0));
    return (geng_cancel) {0};
}
