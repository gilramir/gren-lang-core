/* `Time`'s rows that ask Windows (D499; geng-lang docs/m4-windows.md §WN14,
 * §WN24): the monotonic clock in milliseconds, the local offset in minutes,
 * and the zone's name.
 *
 * The zone's name is `TZ`'s where it is set, as on Linux. Otherwise it is
 * Windows' zone ("Pacific Standard Time") named as IANA names it, from
 * CLDR's table (`geng_core_time_zones.c`, D1094): the row for the user's
 * country if there is one, else the zone's default. A zone the table does
 * not hold, or one whose daylight saving the user has turned off, which no
 * IANA name describes, is answered by its offset, which is `getZoneName`'s
 * answer on Linux too when it finds no name. */

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

typedef struct {
    const char *windows;
    const char *territory;
    const char *iana;
} geng_core_zone;

extern const geng_core_zone geng_core_zones[];
extern const int geng_core_zone_count;

/* The table's name for Windows' zone `key` in `territory`, else its default,
 * else NULL. */
static const char *iana_name(const char *key, const char *territory) {
    const char *fallback = NULL;
    for (int i = 0; i < geng_core_zone_count; i++) {
        const geng_core_zone *z = &geng_core_zones[i];
        if (strcmp(z->windows, key) != 0) continue;
        if (strcmp(z->territory, territory) == 0) return z->iana;
        if (strcmp(z->territory, "001") == 0) fallback = z->iana;
    }
    return fallback;
}

/* The user's country as two letters, or "001", which no row but a default
 * has. */
static void user_territory(char out[3]) {
    wchar_t iso[3];
    GEOID geo = GetUserGeoID(GEOCLASS_NATION);
    if (geo != GEOID_NOT_AVAILABLE && GetGeoInfoW(geo, GEO_ISO2, iso, 3, 0) == 3
        && iso[0] >= L'A' && iso[0] <= L'Z' && iso[1] >= L'A' && iso[1] <= L'Z') {
        out[0] = (char) iso[0];
        out[1] = (char) iso[1];
        out[2] = 0;
        return;
    }
    memcpy(out, "001", 3);
}

static geng_bytes *zone_name(void) {
    const char *tz = getenv("TZ");
    if (tz != NULL && tz[0] != 0) {
        if (tz[0] == ':') tz++;
        return text(tz, strlen(tz));
    }
    DYNAMIC_TIME_ZONE_INFORMATION info;
    if (GetDynamicTimeZoneInformation(&info) == TIME_ZONE_ID_INVALID) return NULL;
    if (info.DynamicDaylightTimeDisabled && info.DaylightDate.wMonth != 0) return NULL;
    /* The keys are ASCII, and no longer than the field. */
    char key[sizeof info.TimeZoneKeyName / sizeof info.TimeZoneKeyName[0]];
    size_t n = 0;
    for (; n + 1 < sizeof key && info.TimeZoneKeyName[n] != 0; n++) {
        if (info.TimeZoneKeyName[n] > 0x7E) return NULL;
        key[n] = (char) info.TimeZoneKeyName[n];
    }
    key[n] = 0;
    char territory[4];
    user_territory(territory);
    const char *name = iana_name(key, territory);
    return name != NULL ? text(name, strlen(name)) : NULL;
}

geng_cancel geng_core_time_getZoneName(void *name, void *name_adapter, void *offset, void *offset_adapter,
                                       geng_wait *wait) {
    geng_bytes *zone = zone_name();
    geng_succeed(wait, zone != NULL ? geng_call(name, name_adapter, (geng_slot[]) {geng_slot_P(zone)})
                                    : geng_call(offset, offset_adapter, (geng_slot[]) {geng_slot_I4(-offset_minutes())}));
    return (geng_cancel) {0};
}
