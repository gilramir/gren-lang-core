/* `Time`'s rows that ask Windows (D499; geng-lang docs/m4-windows.md §WN14):
 * the monotonic clock in milliseconds, the local offset in minutes, and a
 * zone's name from `TZ`.
 *
 * Windows names its zones itself ("Pacific Standard Time"), not as the IANA
 * database does, and the IANA name a Windows zone is needs a table, which
 * Windows has only in its ICU (Windows 10 1903 and later). Until that is
 * measured on Windows (§WN9), a zone with no `TZ` is answered by its offset,
 * which is `getZoneName`'s answer on Linux too when it finds no name. */

#define WIN32_LEAN_AND_MEAN

#include <windows.h>

#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "geng.h"

/* The performance counter in whole milliseconds, computed in integers. */
geng_cancel geng_core_time_monotonic(void *build, void *adapter, geng_wait *wait) {
    LARGE_INTEGER now, frequency;
    QueryPerformanceFrequency(&frequency);
    QueryPerformanceCounter(&now);
    int64_t f = frequency.QuadPart, c = now.QuadPart;
    int64_t millis = c / f * 1000 + c % f * 1000 / f;
    geng_succeed(wait, geng_call(build, adapter, (geng_slot[]) {geng_slot_I8(millis)}));
    return (geng_cancel) {0};
}

/* The local time now, read back as if it were UTC, less the time now. */
static int32_t offset_minutes(void) {
    __time64_t now = _time64(NULL);
    struct tm local;
    if (_localtime64_s(&local, &now) != 0) return 0;
    return (int32_t) ((_mkgmtime64(&local) - now) / 60);
}

geng_cancel geng_core_time_here(void *build, void *adapter, geng_wait *wait) {
    geng_succeed(wait, geng_call(build, adapter, (geng_slot[]) {geng_slot_I4(offset_minutes())}));
    return (geng_cancel) {0};
}

static geng_bytes *text(const char *s, size_t n) {
    geng_bytes *b = geng_alloc(sizeof *b + n, GENG_HEADER_BYTES(sizeof *b + n));
    b->length = (int32_t) n;
    b->pad = 0;
    b->data = (uint8_t *) (b + 1);
    b->buffer = NULL;
    b->block = NULL;
    memcpy(b->data, s, n);
    return b;
}

static geng_bytes *zone_name(void) {
    const char *tz = getenv("TZ");
    if (tz != NULL && tz[0] != 0) {
        if (tz[0] == ':') tz++;
        return text(tz, strlen(tz));
    }
    return NULL;
}

geng_cancel geng_core_time_getZoneName(void *name, void *name_adapter, void *offset, void *offset_adapter,
                                       geng_wait *wait) {
    geng_bytes *zone = zone_name();
    geng_succeed(wait, zone != NULL ? geng_call(name, name_adapter, (geng_slot[]) {geng_slot_P(zone)})
                                    : geng_call(offset, offset_adapter, (geng_slot[]) {geng_slot_I4(-offset_minutes())}));
    return (geng_cancel) {0};
}
