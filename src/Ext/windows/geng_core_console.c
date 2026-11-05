/* `Console`'s rows on Windows (D499, ffi.md F1; geng-lang docs/m4-windows.md
 * §WN14), as Linux's are: the bytes written as they are, UTF-8, with
 * `WriteFile` on the standard handle until every byte is taken, unbuffered
 * (D532), so what a program wrote is in the file or the pipe when the task
 * completes. Any failure drops the rest: `Console` cannot fail.
 *
 * What a console shows of the bytes is its code page's reading of them,
 * which is UTF-8 only where the console's output code page is 65001 (§WN9,
 * to be measured on Windows). */

#define WIN32_LEAN_AND_MEAN

#include <windows.h>

#include "geng.h"

static void write_all(DWORD which, geng_bytes *text) {
    HANDLE handle = GetStdHandle(which);
    if (handle == NULL || handle == INVALID_HANDLE_VALUE) return;
    const uint8_t *data = (const uint8_t *) text->data;
    size_t left = (size_t) text->length;
    while (left > 0) {
        DWORD wrote = 0;
        DWORD ask = left > 0x40000000u ? 0x40000000u : (DWORD) left;
        if (!WriteFile(handle, data, ask, &wrote, NULL) || wrote == 0) return;
        data += wrote;
        left -= wrote;
    }
}

geng_cancel geng_core_console_write(void *text, geng_wait *wait) {
    write_all(STD_OUTPUT_HANDLE, text);
    geng_succeed(wait, geng_slot_U(0));
    return (geng_cancel) {0};
}

geng_cancel geng_core_console_writeErr(void *text, geng_wait *wait) {
    write_all(STD_ERROR_HANDLE, text);
    geng_succeed(wait, geng_slot_U(0));
    return (geng_cancel) {0};
}
