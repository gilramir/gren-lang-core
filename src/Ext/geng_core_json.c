/* `Json`'s rows (geng-lang docs/m3-closeout.md §CL18).
 *
 * D776: a string with an escape, decoded in C, as `Json.Value.scan` decodes
 * it. The Geng scan appends a slice and a piece at every escape, a new string
 * each; this reads the string twice, once for its length and once to write
 * it, and makes one. Wherever the scan would fail it answers `notFound`, and
 * the scan then runs to say why.
 *
 * D777: whether an object's keys repeat, below. */

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include "geng.h"

static int32_t hex_digit(uint8_t c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

/* Four hexadecimal digits at `i` as a number, or -1, as `hex4`. */
static int32_t hex4(const uint8_t *p, int32_t end, int32_t i) {
    if (i + 4 > end) return -1;
    int32_t a = hex_digit(p[i]), b = hex_digit(p[i + 1]), c = hex_digit(p[i + 2]), d = hex_digit(p[i + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) return -1;
    return ((a * 16 + b) * 16 + c) * 16 + d;
}

static int32_t utf8_length(int32_t cp) { return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4; }

static uint8_t *utf8_write(uint8_t *out, int32_t cp) {
    if (cp < 0x80) {
        *out++ = (uint8_t) cp;
    } else if (cp < 0x800) {
        *out++ = (uint8_t) (0xC0 | cp >> 6);
        *out++ = (uint8_t) (0x80 | (cp & 0x3F));
    } else if (cp < 0x10000) {
        *out++ = (uint8_t) (0xE0 | cp >> 12);
        *out++ = (uint8_t) (0x80 | (cp >> 6 & 0x3F));
        *out++ = (uint8_t) (0x80 | (cp & 0x3F));
    } else {
        *out++ = (uint8_t) (0xF0 | cp >> 18);
        *out++ = (uint8_t) (0x80 | (cp >> 12 & 0x3F));
        *out++ = (uint8_t) (0x80 | (cp >> 6 & 0x3F));
        *out++ = (uint8_t) (0x80 | (cp & 0x3F));
    }
    return out;
}

/* What the character after a backslash stands for, where it is one of the
 * seven that stand for one character; 0 for `u` and for every escape the scan
 * refuses. */
static const uint8_t simple[256] = {
    ['"'] = '"', ['\\'] = '\\', ['/'] = '/', ['n'] = '\n', ['t'] = '\t', ['r'] = '\r', ['b'] = '\b', ['f'] = '\f',
};

/* The escape whose backslash is at `*at`: the codepoint it stands for, with
 * `*at` moved past it, or -1 where the scan fails. Half a surrogate pair is
 * U+FFFD (D209). */
static inline int32_t escape(const uint8_t *p, int32_t end, int32_t *at) {
    int32_t i = *at;
    if (i + 1 >= end) return -1;
    uint8_t e = p[i + 1];
    if (simple[e] != 0) {
        *at = i + 2;
        return simple[e];
    }
    if (e != 'u') return -1;
    int32_t u = hex4(p, end, i + 2);
    if (u < 0) return -1;
    if (u >= 0xD800 && u <= 0xDBFF) {
        int32_t low = i + 7 < end && p[i + 6] == '\\' && p[i + 7] == 'u' ? hex4(p, end, i + 8) : -1;
        if (low >= 0xDC00 && low <= 0xDFFF) {
            *at = i + 12;
            return 0x10000 + (u - 0xD800) * 0x400 + (low - 0xDC00);
        }
        *at = i + 6;
        return 0xFFFD;
    }
    *at = i + 6;
    return u >= 0xDC00 && u <= 0xDFFF ? 0xFFFD : u;
}

geng_slot geng_core_json_unescape(void *found, void *found_adapter, geng_slot not_found, void *text, int32_t end,
                                  int32_t start, int32_t backslash) {
    const uint8_t *p = ((geng_bytes *) text)->data;
    /* The first pass: where the closing quote is and how long the string is,
     * or the scan's failure. */
    int64_t length = backslash - start;
    int32_t i = backslash;
    for (;;) {
        if (i >= end) return not_found;
        uint8_t c = p[i];
        if (c == '"') break;
        if (c == '\\') {
            int32_t cp = escape(p, end, &i);
            if (cp < 0) return not_found;
            length += utf8_length(cp);
        } else if (c < 0x20) {
            return not_found;
        } else {
            length++;
            i++;
        }
    }
    int32_t closing = i;
    /* Never longer than the text it came from, which is a `String`; atomic,
     * as the runtime's `geng_bytes_new` makes one, its one pointer being
     * into itself. */
    geng_bytes *it = geng_alloc_atomic(sizeof *it + (size_t) length, GENG_HEADER_BYTES(sizeof *it + (size_t) length));
    it->length = (int32_t) length;
    it->pad = 0;
    it->data = (uint8_t *) (it + 1);
    it->buffer = NULL;
    it->block = NULL;
    /* `p` is still the text's: a word on the stack pointing into an object
     * pins it through a collection in that allocation (geng.c). */
    uint8_t *out = it->data;
    memcpy(out, p + start, (size_t) (backslash - start));
    out += backslash - start;
    i = backslash;
    while (i < closing) {
        if (p[i] == '\\') {
            out = utf8_write(out, escape(p, end, &i));
        } else {
            /* A run of a few bytes, the common case between escapes, is
             * copied here rather than by a call. */
            int32_t run = i;
            while (i < closing && p[i] != '\\') i++;
            if (i - run <= 16) {
                for (int32_t k = run; k < i; k++) *out++ = p[k];
            } else {
                memcpy(out, p + run, (size_t) (i - run));
                out += i - run;
            }
        }
    }
    return geng_call(found, found_adapter, (geng_slot[]) {geng_slot_P(it), geng_slot_I4(closing + 1)});
}

/* `Json.Value.repeatsKey` (D777): whether any of an object's keys is there
 * twice, by open addressing over their indices. The table is malloc's, and
 * nothing here allocates from the collector, so no key moves while it is
 * read. */
int32_t geng_core_json_repeats_key(void *keys_array) {
    int32_t count = geng_array_length(keys_array);
    geng_bytes **keys = geng_array_items(keys_array);
    size_t size = 16;
    while (size < (size_t) count * 2) size *= 2;
    int32_t local[64];
    int32_t *slots = size <= 64 ? local : malloc(size * sizeof *slots);
    if (slots == NULL) geng_crash("out of memory");
    for (size_t k = 0; k < size; k++) slots[k] = -1;
    int repeats = 0;
    for (int32_t i = 0; i < count && !repeats; i++) {
        const geng_bytes *key = keys[i];
        /* FNV-1a. */
        uint64_t hash = 14695981039346656037u;
        for (int32_t k = 0; k < key->length; k++) hash = (hash ^ key->data[k]) * 1099511628211u;
        size_t at = (size_t) (hash ^ hash >> 32) & (size - 1);
        for (;; at = (at + 1) & (size - 1)) {
            if (slots[at] < 0) {
                slots[at] = i;
                break;
            }
            const geng_bytes *other = keys[slots[at]];
            if (other->length == key->length && memcmp(other->data, key->data, (size_t) key->length) == 0) {
                repeats = 1;
                break;
            }
        }
    }
    if (slots != local) free(slots);
    return repeats ? geng_true : geng_false;
}
