/* `Time`'s rows (D499; geng-lang docs/m3-native.md §NA24), as the Erlang row
 * answers them: the wall clock in milliseconds, the local offset in minutes,
 * a zone's name from `TZ`, `/etc/localtime`'s link into the zoneinfo tree or
 * `/etc/timezone`, and `every` a repeating timer that emits into its source
 * until cancelled or the source is closed. */

#define _DEFAULT_SOURCE

#include <limits.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#include "geng.h"

geng_cancel geng_core_time_now(void *build, geng_wait *wait) {
    geng_succeed(wait, geng_slot_P(geng_call_I8(build, geng_now_wall())));
    return (geng_cancel) {0};
}

static int32_t offset_minutes(void) {
    time_t now = time(NULL);
    struct tm local;
    localtime_r(&now, &local);
    return (int32_t) (local.tm_gmtoff / 60);
}

geng_cancel geng_core_time_here(void *build, geng_wait *wait) {
    geng_succeed(wait, geng_slot_P(geng_call_I4(build, offset_minutes())));
    return (geng_cancel) {0};
}

static geng_bytes *text(const char *s, size_t n) {
    geng_bytes *b = geng_alloc(sizeof *b + n);
    b->length = (int32_t) n;
    b->pad = 0;
    b->data = (uint8_t *) (b + 1);
    b->buffer = NULL;
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

geng_cancel geng_core_time_getZoneName(void *name, void *offset, geng_wait *wait) {
    geng_bytes *zone = zone_name();
    void *answer = zone != NULL ? geng_call_P(name, zone) : geng_call_I4(offset, -offset_minutes());
    geng_succeed(wait, geng_slot_P(answer));
    return (geng_cancel) {0};
}

typedef struct {
    double interval;
    void *source;
    void *build;
    geng_timer *timer;
    int stopped;
} ticker;

static void tick(void *env) {
    ticker *t = env;
    if (t->stopped) return;
    if (!geng_source_emit(t->source, geng_slot_P(geng_call_I8(t->build, geng_now_wall())))) {
        t->stopped = 1;
        return;
    }
    t->timer = geng_timer_start(t->interval, tick, t);
}

geng_cancel geng_core_time_every(double interval, void *source, void *build, geng_wait *wait) {
    ticker *t = geng_alloc(sizeof *t);
    t->interval = interval > 0 && !isinf(interval) ? round(interval) : 0;
    t->source = source;
    t->build = build;
    t->stopped = 0;
    t->timer = geng_timer_start(t->interval, tick, t);
    geng_succeed(wait, geng_slot_P(t));
    return (geng_cancel) {0};
}

geng_cancel geng_core_time_cancel(void *handle, geng_wait *wait) {
    ticker *t = handle;
    t->stopped = 1;
    geng_timer_cancel(t->timer);
    geng_succeed(wait, geng_slot_U(0));
    return (geng_cancel) {0};
}
