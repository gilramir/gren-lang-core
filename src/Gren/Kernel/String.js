/*

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

var _String_contains = F2(function (sub, str) {
  return str.indexOf(sub) > -1;
});

var _String_startsWith = F2(function (sub, str) {
  return str.indexOf(sub) === 0;
});

var _String_endsWith = F2(function (sub, str) {
  return (
    str.length >= sub.length && str.lastIndexOf(sub) === str.length - sub.length
  );
});

var _String_indexOf = F2(function (sub, str) {
  var ret = str.indexOf(sub);

  if (ret > -1) {
    return __Maybe_Just(ret);
  }

  return __Maybe_Nothing;
});

var _String_lastIndexOf = F2(function (sub, str) {
  var ret = str.lastIndexOf(sub);

  if (ret > -1) {
    return __Maybe_Just(ret);
  }

  return __Maybe_Nothing;
});

var _String_indexes = F2(function (sub, str) {
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
