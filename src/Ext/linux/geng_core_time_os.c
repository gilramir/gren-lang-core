/* `Time`'s rows that ask Linux (D499; geng-lang docs/m3-native.md §NA24), as
 * the Erlang row answers them: the monotonic clock in milliseconds, the local
 * offset in minutes, and a zone's name from `TZ`, `/etc/localtime`'s link
 * into the zoneinfo tree or `/etc/timezone`. */

#define _DEFAULT_SOURCE

#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#include "geng.h"

/* `CLOCK_MONOTONIC` in whole milliseconds, computed in integers. */
geng_cancel geng_core_time_monotonic(void *build, void *adapter, geng_wait *wait) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    int64_t millis = (int64_t) ts.tv_sec * 1000 + ts.tv_nsec / 1000000;
    geng_succeed(wait, geng_call(build, adapter, (geng_slot[]) {geng_slot_I8(millis)}));
    return (geng_cancel) {0};
}

static int32_t offset_minutes(void) {
    time_t now = time(NULL);
    struct tm local;
    localtime_r(&now, &local);
    return (int32_t) (local.tm_gmtoff / 60);
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
    static char link[PATH_MAX];
    ssize_t n = readlink("/etc/localtime", link, sizeof link - 1);
    if (n > 0) {
        link[n] = 0;
        char *at = strstr(link, "zoneinfo/");
        return at == NULL ? NULL : text(at + 9, strlen(at + 9));
    }
    FILE *f = fopen("/etc/timezone", "r");
    if (f != NULL) {
        char line[256];
        geng_bytes *name = NULL;
        if (fgets(line, sizeof line, f) != NULL) {
            size_t k = strcspn(line, "\r\n");
            while (k > 0 && (line[k - 1] == ' ' || line[k - 1] == '\t')) k--;
            if (k > 0) name = text(line, k);
        }
        fclose(f);
        return name;
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
