/*

import Basics exposing (LT, EQ, GT)
import Maybe exposing (Just, Nothing)

*/

// A `Char` here is a **code point**: an ordinary JavaScript number, the same
// value `Char.toCode` answers with (C8, `docs/m1b-str.md` §T12). It used to be
// a one-character string, boxed in a `String` object by dev builds so that the
// untyped printer could tell one from a `String`, and every function below that
// takes or yields a character is where that difference lived.
//
// So a `String` is still UTF-16 and a character is no longer a piece of one:
// `String.fromCodePoint` and `codePointAt` are the conversion, and they are
// here rather than at the call sites in `String.gren` because this is the file
// that knows what a JavaScript string is made of.

var _String_pushFirst = F2(function (char, string) {
  return String.fromCodePoint(char) + string;
});

var _String_pushLast = F2(function (char, string) {
  return string + String.fromCodePoint(char);
});

var _String_popFirst = function (string) {
  if (string.length <= 0) {
    return __Maybe_Nothing;
  }

  var firstPointNumber = string.codePointAt(0);

  return __Maybe_Just({
    __$first: firstPointNumber,
    __$rest: string.slice(firstPointNumber > 0xffff ? 2 : 1),
  });
};

var _String_popLast = function (string) {
  var strLen = string.length;

  if (strLen === 0) {
    return __Maybe_Nothing;
  } else if (strLen === 1) {
    return __Maybe_Just({
      __$last: string.charCodeAt(0),
      __$rest: "",
    });
  }

  var secondLastIdx = strLen - 2;
  var possiblyLastPoint = string.codePointAt(secondLastIdx);

  if (possiblyLastPoint > 0xffff) {
    // last character is two units
    return __Maybe_Just({
      __$last: possiblyLastPoint,
      __$rest: string.slice(0, strLen - 2),
    });
  }

  return __Maybe_Just({
    __$last: string.charCodeAt(strLen - 1),
    __$rest: string.slice(0, strLen - 1),
  });
};

var _String_append = F2(function (a, b) {
  return a + b;
});

// COMPARISON

// `Ord String` is codepoint order (D8, `docs/m1b-str.md` §T13), and JavaScript
// `<` is code unit order. The two disagree only when a surrogate is involved: a
// surrogate pair encodes a codepoint above 0xFFFF with a lead unit in
// 0xD800..0xDBFF, which is *below* 0xE000..0xFFFF, so "\u{10000}" < "\u{FFFE}"
// on `<` and greater on any reading of the characters. A string with no code
// unit in the surrogate range sorts identically either way.
//
// So the regex is a guard and not an approximation: when it fires for neither
// side, `<` is the answer. When it fires, the scan walks to the first differing
// code unit and `codePointAt` reads the whole codepoint there — a lead surrogate
// reads as the astral character it starts, a BMP unit as itself — which is the
// fixup nobody wants to write by hand.
//
// §T13.2 measured four ways of doing this. The scan alone is 8.7x native on
// keys with a long shared prefix, which is what a compiler's `Dict String v`
// holds; the guard keeps it at 2.4x by paying two native regex scans instead of
// an interpreted loop over the prefix.
var _String_surrogate = /[\uD800-\uDFFF]/;

var _String_compare = F2(function (a, b) {
  if (a === b) {
    return __Basics_EQ;
  }

  if (!_String_surrogate.test(a) && !_String_surrogate.test(b)) {
    return a < b ? __Basics_LT : __Basics_GT;
  }

  var n = a.length < b.length ? a.length : b.length;
  var i = 0;
  while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) {
    i++;
  }

  if (i === n) {
    return a.length < b.length ? __Basics_LT : __Basics_GT;
  }

  return a.codePointAt(i) < b.codePointAt(i) ? __Basics_LT : __Basics_GT;
});

var _String_repeat = F2(function (num, chunk) {
  try {
    return chunk.repeat(num);
  } catch (error) {
    if (error.name === "RangeError") {
      return "";
    } else {
      throw error;
    }
  }
});

// `for (let char of string)` iterates by code point, which is what makes these
// two the codepoint-oriented folds; what the loop yields is a one- or
// two-unit string, and `codePointAt(0)` is the number it stands for.
var _String_foldl = F3(function (func, state, string) {
  for (let char of string) {
    state = A2(func, char.codePointAt(0), state);
  }

  return state;
});

var _String_foldr = F3(function (func, state, string) {
  let reversed = [];

  for (let char of string) {
    reversed.unshift(char.codePointAt(0));
  }

  for (let code of reversed) {
    state = A2(func, code, state);
  }

  return state;
});

var _String_split = F2(function (sep, str) {
  return str.split(sep);
});

var _String_join = F2(function (sep, strs) {
  return strs.join(sep);
});

var _String_slice = F3(function (start, end, str) {
  return Array.from(str).slice(start, end).join("");
});

function _String_trim(str) {
  return str.trim();
}

function _String_trimLeft(str) {
  return str.replace(/^\s+/, "");
}

function _String_trimRight(str) {
  return str.replace(/\s+$/, "");
}

function _String_words(str) {
  return str.trim().split(/\s+/g);
}

function _String_lines(str) {
  return str.split(/\r\n|\r|\n/g);
}

function _String_toUpper(str) {
  return str.toUpperCase();
}

function _String_toLower(str) {
  return str.toLowerCase();
}

var _String_any = F2(function (isGood, string) {
  for (let char of string) {
    if (isGood(char.codePointAt(0))) {
      return true;
    }
  }

  return false;
});

// SEARCHING, AND WHAT AN INDEX IS
//
// An index into a `String` is a **codepoint** index (D8, `docs/m1b-str.md`
// §T15). JavaScript's `indexOf` answers in code units, so every function below
// that produces an index converts, and the two that produce a `Bool` have to
// agree with them about what counts as a match.
//
// Two separate questions, and keeping them apart is what makes this cheap.
//
// **Does the match land on codepoint boundaries?** Two `charCodeAt`s decide it
// at each end, no scan. It can fail: a needle that begins with a lone trail
// surrogate matches the back half of an astral character, one that ends with a
// lone lead surrogate matches the front half, and a `String` can hold a lone
// surrogate today (§T12.4, and `sliceUnits` cutting a pair). D160 says such a
// match is not a match — there is no codepoint index for it, and the promise
// `firstIndexOf` makes is that slicing at what it answers returns the needle.
// **Both** ends have to be checked; checking only the start was this step's
// first mistake, and `accept/string-index-surrogate-half`'s `startsWith` row is
// what caught it.
//
// **What codepoint offset does a unit offset correspond to?** The unit offset
// minus the number of surrogate *pairs* that start before it, because a pair is
// the only thing that spends two units on one codepoint; a lone surrogate is
// one codepoint of one unit and must not be counted. The count comes from this
// regex rather than an interpreted loop, and the difference is not small: on a
// 30 KB source with astral characters in it, 20 us against 180 (§T15.2).
//
// The regex is also free on most strings, which is the thing worth knowing
// about this file. V8 stores a string whose every character is at or below 0xFF
// in one byte per character, and no such string can hold a surrogate, so the
// search is decided from the string's kind without reading it: 0.06 us on a
// 30 KB Latin-1 string against 19.6 on a 30 KB two-byte one. The line is "does
// this string contain a character above U+00FF", not "does it contain a
// surrogate".
var _String_pair = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;

function _String_splitsPair(str, i) {
  if (i <= 0 || i >= str.length) {
    return false;
  }

  var lead = str.charCodeAt(i - 1);
  if (lead < 0xd800 || lead > 0xdbff) {
    return false;
  }

  var trail = str.charCodeAt(i);
  return trail >= 0xdc00 && trail <= 0xdfff;
}

function _String_codepointOffset(str, i) {
  _String_pair.lastIndex = 0;

  var pairs = 0;
  var match;
  while ((match = _String_pair.exec(str)) !== null && match.index + 2 <= i) {
    pairs++;
  }

  return i - pairs;
}

function _String_aligned(sub, str, i) {
  return !_String_splitsPair(str, i) && !_String_splitsPair(str, i + sub.length);
}

// The first unit offset at or after `from` where `sub` occurs on codepoint
// boundaries at both ends, or -1.
function _String_alignedIndexOf(sub, str, from) {
  var i = str.indexOf(sub, from);

  while (i > -1 && !_String_aligned(sub, str, i)) {
    i = str.indexOf(sub, i + 1);
  }

  return i;
}

var _String_contains = F2(function (sub, str) {
  return _String_alignedIndexOf(sub, str, 0) > -1;
});

// Offset 0 cannot be inside a pair; the far end of the needle can be.
var _String_startsWith = F2(function (sub, str) {
  return str.indexOf(sub) === 0 && !_String_splitsPair(str, sub.length);
});

var _String_endsWith = F2(function (sub, str) {
  return (
    str.length >= sub.length &&
    str.lastIndexOf(sub) === str.length - sub.length &&
    !_String_splitsPair(str, str.length - sub.length)
  );
});

var _String_indexOf = F2(function (sub, str) {
  var i = _String_alignedIndexOf(sub, str, 0);

  if (i > -1) {
    return __Maybe_Just(_String_codepointOffset(str, i));
  }

  return __Maybe_Nothing;
});

var _String_lastIndexOf = F2(function (sub, str) {
  var i = str.lastIndexOf(sub);

  while (i > 0 && !_String_aligned(sub, str, i)) {
    i = str.lastIndexOf(sub, i - 1);
  }

  if (i > -1) {
    return __Maybe_Just(_String_codepointOffset(str, i));
  }

  return __Maybe_Nothing;
});

// One walk for every match, not one walk each. The unit offsets come out
// increasing, so a single pass of the pair regex converts all of them: per-match
// conversion is 125 ms where this is 0.4 on the same 30 KB source (§T15.2).
var _String_indexes = F2(function (sub, str) {
  var subLen = sub.length;

  if (subLen < 1) {
    return [];
  }

  var units = [];
  var i = _String_alignedIndexOf(sub, str, 0);

  while (i > -1) {
    units.push(i);
    i = _String_alignedIndexOf(sub, str, i + subLen);
  }

  _String_pair.lastIndex = 0;

  var match = _String_pair.exec(str);
  var pairs = 0;
  var out = [];

  for (var k = 0; k < units.length; k++) {
    var unit = units[k];

    while (match !== null && match.index + 2 <= unit) {
      pairs++;
      match = _String_pair.exec(str);
    }

    out.push(unit - pairs);
  }

  return out;
});

// TO STRING

function _String_fromNumber(number) {
  return number + "";
}

// INT CONVERSIONS

function _String_toInt(str) {
  var total = 0;
  var code0 = str.charCodeAt(0);
  var start = code0 == 0x2b /* + */ || code0 == 0x2d /* - */ ? 1 : 0;

  for (var i = start; i < str.length; ++i) {
    var code = str.charCodeAt(i);
    if (code < 0x30 || 0x39 < code) {
      return __Maybe_Nothing;
    }
    total = 10 * total + (code - 0x30);
  }

  return i == start
    ? __Maybe_Nothing
    : __Maybe_Just(code0 == 0x2d ? -total : total);
}

// FLOAT CONVERSIONS

function _String_toFloat(s) {
  // check if it is a hex, octal, or binary number
  if (s.length === 0 || /[\sxbo]/.test(s)) {
    return __Maybe_Nothing;
  }
  var n = +s;
  // faster isNaN check
  return n === n ? __Maybe_Just(n) : __Maybe_Nothing;
}

// Not `String.fromCodePoint(...chars)`: a spread is an argument list, and an
// argument list has a length limit that a `String` does not. `join` over a
// mapped array is the same answer for every size of input.
function _String_fromArray(chars) {
  var out = "";

  for (var i = 0; i < chars.length; i++) {
    out += String.fromCodePoint(chars[i]);
  }

  return out;
}

// UNITS

var _String_unitLength = function (str) {
  return str.length;
};

// THE TWO INDEX FUNCTIONS THE UNIT MODEL STILL NEEDS
//
// `String.Parser.Advanced` threads a code-unit offset through every combinator
// -- `sliceUnits` consumes it and `unitLength` produces it -- and two of its
// call sites reach for `String.firstIndexOf` and `String.indices` to move that
// offset along. Those answer codepoint indices as of D8's step 3, so adding one
// to a unit offset is now a type error the compiler cannot see, and these are
// the bodies those two call sites used to get.
//
// They are not exposed from `String`: the `*Units` family stays at five, and
// `m1b-str.md` §T4's table -- which counted `unitLength`, `getUnit` and
// `sliceUnits` and missed these two -- is corrected in §T15.3. They die with the
// offset model, at step 6.

var _String_indexOfUnits = F2(function (sub, str) {
  var ret = str.indexOf(sub);

  if (ret > -1) {
    return __Maybe_Just(ret);
  }

  return __Maybe_Nothing;
});

var _String_indexesUnits = F2(function (sub, str) {
  var subLen = sub.length;

  if (subLen < 1) {
    return [];
  }

  var i = 0;
  var is = [];

  while ((i = str.indexOf(sub, i)) > -1) {
    is.push(i);
    i = i + subLen;
  }

  return is;
});

// THE UNITS FAMILY YIELDS SOMETHING THAT IS NOT A `Char`
//
// A UTF-16 code unit can be half of a surrogate pair, and half a pair is not a
// scalar value, so what these three hand the caller is a number in
// `0 .. 0xFFFF` that C8 says is not a `Char`. That was true before a `Char` was
// a number as well -- `String.gren`'s own docs say the value "could possibly
// represent one half of a full code point" -- and D8 is what closes it: the
// family leaves `core` for a `target = "js"` package (`m1b-str.md` §T4, step 6).
// Until then this is the one place in `core` where the `Char` type is a lie, and
// it is a smaller lie than it was: the number is the code unit, where before it
// was a string holding an unpaired surrogate.

var _String_getUnit = F2(function (index, str) {
  var i = index < 0 ? str.length + index : index;

  if (i < 0 || i >= str.length) {
    return __Maybe_Nothing;
  }

  return __Maybe_Just(str.charCodeAt(i));
});

var _String_foldlUnits = F3(function (fn, state, str) {
  for (let i = 0; i < str.length; i++) {
    state = A2(fn, str.charCodeAt(i), state);
  }

  return state;
});

var _String_foldrUnits = F3(function (fn, state, str) {
  for (let i = str.length - 1; i >= 0; i--) {
    state = A2(fn, str.charCodeAt(i), state);
  }

  return state;
});

var _String_sliceUnits = F3(function (start, end, str) {
  return str.slice(start, end);
});
