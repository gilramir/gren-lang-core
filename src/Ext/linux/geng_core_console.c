/* `Console`'s rows (D499, ffi.md F1; geng-lang docs/m3-native.md §NA24).
 *
 * Called as D193's convention in C: the arguments, then the wait, answered
 * through `geng_succeed`; nothing to cancel. The bytes are written as they
 * are, UTF-8.
 *
 * Unbuffered (D532, geng-lang docs/m3-os.md §OS14): each call is `write(2)` to
 * the descriptor until every byte is taken, so what a program wrote is in the
 * file or the pipe when the task completes, and nothing is lost when a stack
 * fault ends the program with `_exit` (§NA26). A write interrupted by a signal
 * is retried; one that would block, because whoever shares the descriptor made
 * it non-blocking, waits in poll(2) until the descriptor can take more. Any
 * other failure drops the rest: `Console` cannot fail. */

#include <errno.h>
#include <poll.h>
#include <unistd.h>

#include "geng.h"

static void write_all(int fd, geng_bytes *text) {
    const uint8_t *data = (const uint8_t *) text->data;
    size_t left = (size_t) text->length;
    while (left > 0) {
        ssize_t n = write(fd, data, left);
        if (n > 0) {
            data += n;
            left -= (size_t) n;
        } else if (n < 0 && errno == EINTR) {
            continue;
        } else if (n < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) {
            struct pollfd p = {.fd = fd, .events = POLLOUT};
            while (poll(&p, 1, -1) < 0 && errno == EINTR) {
            }
        } else {
            return;
        }
    }
}

geng_cancel geng_core_console_write(void *text, geng_wait *wait) {
    write_all(1, text);
    geng_succeed(wait, geng_slot_U(0));
    return (geng_cancel) {0};
}

geng_cancel geng_core_console_writeErr(void *text, geng_wait *wait) {
    write_all(2, text);
    geng_succeed(wait, geng_slot_U(0));
    return (geng_cancel) {0};
}
