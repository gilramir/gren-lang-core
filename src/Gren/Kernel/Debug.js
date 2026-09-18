/*

import Dict exposing (foldl)
import Set exposing (toArray)

*/

// LOG

// `Debug.log` renders in Gren now (D158), so what arrives here is the finished
// line rather than a value: `inspect` has already been applied and the tag
// joined on. That is what takes `_Debug_toAnsiString` off this path — two
// callers of it remain, an incomplete `case` and the REPL — and what lets
// `core.md` C13's `debug_log` be a primitive every backend can answer with a
// `console.log`, rather than one that obliges each of them to walk a value.
var _Debug_log__PROD = F2(function (line, value) {
  return value;
});

var _Debug_log__DEBUG = F2(function (line, value) {
  console.log(line);
  return value;
});

// TODOS
//
// `Debug.todo` is not here any more: the lowering makes each one an `ECrash
// Todo` carrying where it was written and its message, and the backend's
// `_Crash_todo` throws (D335, geng-lang `m1a-lowering.md` §L4). `_Debug_todo`
// took a module name and a region that stock's code generator filled in and
// this one never did, so it answered a function instead of crashing
// (`m1b-extern.md` §H18.4). `_Debug_todoCase` and `_Debug_crash`, which only it
// reached, went with it.

// TO STRING
//
// `Debug.toString` is gone (D16, `syntax.md` S8): `inspect` replaced it, and
// unlike this walker `inspect` is typed, total, pinned by
// `docs/representation.md` R5, and written in Gren rather than in one runtime's
// JavaScript. What is left here has no Gren binding and one caller that is
// not `inspect`'s to take: `Generate.CoreJS.printForRepl`, which prints a REPL
// entry of any type. (`Debug.log` was another until D158 made it render with
// `inspect`, and `_Debug_crash`'s case 9 a third until D335 deleted it.)
//
// So the `Dict` and `Set` tag-matching below stays too, and stays a duplicate
// of the instances `Dict` and `Set` now write. `m1b-classes.md` §G45 registers
// what it would take to close that: it is `Debug.log`'s signature, which is a
// decision rather than a cleanup.

function _Debug_toString__PROD(value) {
  return "<internals>";
}

function _Debug_toString__DEBUG(value) {
  return _Debug_toAnsiString(false, value);
}

function _Debug_toAnsiString(ansi, value) {
  if (value == null) {
    return _Debug_internalColor(ansi, "<null>");
  }

  if (typeof value === "function") {
    return _Debug_internalColor(ansi, "<function>");
  }

  if (typeof value === "boolean") {
    return _Debug_ctorColor(ansi, value ? "True" : "False");
  }

  if (typeof value === "number") {
    return _Debug_numberColor(ansi, value + "");
  }

  // D2's 64-bit types are `BigInt`s (D74). The printer is untyped -- it is what
  // the REPL, `Debug.log` and an incomplete `case` use -- so it cannot tell an
  // `Int64` from a `UInt64` and does not try: what it can say is the number,
  // which is more than `<internals>` said. `inspect` is the typed renderer and
  // is where R5's `42i64` suffix comes from.
  if (typeof value === "bigint") {
    return _Debug_numberColor(ansi, value.toString());
  }

  if (value instanceof String) {
    return _Debug_charColor(ansi, "'" + _Debug_addSlashes(value, true) + "'");
  }

  if (typeof value === "string") {
    return _Debug_stringColor(
      ansi,
      '"' + _Debug_addSlashes(value, false) + '"',
    );
  }

  if (Array.isArray(value)) {
    var output = "[";

    value.length > 0 && (output += _Debug_toAnsiString(ansi, value[0]));

    for (var idx = 1; idx < value.length; idx++) {
      output += ", " + _Debug_toAnsiString(ansi, value[idx]);
    }

    return output + "]";
  }

  if (typeof value === "object" && "$" in value) {
    var tag = value.$;

    if (typeof tag === "number") {
      return _Debug_internalColor(ansi, "<internals>");
    }

    if (tag === "Set_gren_builtin") {
      return (
        _Debug_ctorColor(ansi, "Set") +
        _Debug_fadeColor(ansi, ".fromArray") +
        " " +
        _Debug_toAnsiString(ansi, __Set_toArray(value))
      );
    }

    if (tag === "RBNode_gren_builtin" || tag === "RBEmpty_gren_builtin") {
      return (
        _Debug_ctorColor(ansi, "Dict") +
        _Debug_fadeColor(ansi, ".fromArray") +
        " " +
        _Debug_toAnsiString(
          ansi,
          A3(
            __Dict_foldl,
            F3(function (key, value, acc) {
              acc.push({ key: key, value: value });
              return acc;
            }),
            [],
            value,
          ),
        )
      );
    }

    var output = "";
    for (var i in value) {
      if (i === "$") continue;
      var str = _Debug_toAnsiString(ansi, value[i]);
      var c0 = str[0];
      var parenless =
        c0 === "{" ||
        c0 === "(" ||
        c0 === "[" ||
        c0 === "<" ||
        c0 === '"' ||
        str.indexOf(" ") < 0;
      output += " " + (parenless ? str : "(" + str + ")");
    }
    return _Debug_ctorColor(ansi, tag) + output;
  }

  if (value instanceof DataView) {
    return _Debug_stringColor(ansi, "<" + value.byteLength + " bytes>");
  }

  if (typeof File !== "undefined" && value instanceof File) {
    return _Debug_internalColor(ansi, "<" + value.name + ">");
  }

  if (typeof value === "object") {
    var output = [];
    for (var key in value) {
      var field = key[0] === "_" ? key.slice(1) : key;
      output.push(
        _Debug_fadeColor(ansi, field) +
          " = " +
          _Debug_toAnsiString(ansi, value[key]),
      );
    }
    if (output.length === 0) {
      return "{}";
    }
    return "{ " + output.join(", ") + " }";
  }

  return _Debug_internalColor(ansi, "<internals>");
}

function _Debug_addSlashes(str, isChar) {
  var s = str
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .replace(/\r/g, "\\r")
    .replace(/\v/g, "\\v")
    .replace(/\0/g, "\\0");

  if (isChar) {
    return s.replace(/\'/g, "\\'");
  } else {
    return s.replace(/\"/g, '\\"');
  }
}

function _Debug_ctorColor(ansi, string) {
  return ansi ? "\x1b[96m" + string + "\x1b[0m" : string;
}

function _Debug_numberColor(ansi, string) {
  return ansi ? "\x1b[95m" + string + "\x1b[0m" : string;
}

function _Debug_stringColor(ansi, string) {
  return ansi ? "\x1b[93m" + string + "\x1b[0m" : string;
}

function _Debug_charColor(ansi, string) {
  return ansi ? "\x1b[92m" + string + "\x1b[0m" : string;
}

function _Debug_fadeColor(ansi, string) {
  return ansi ? "\x1b[37m" + string + "\x1b[0m" : string;
}

function _Debug_internalColor(ansi, string) {
  return ansi ? "\x1b[36m" + string + "\x1b[0m" : string;
}

function _Debug_toHexDigit(n) {
  return String.fromCharCode(n < 10 ? 48 + n : 55 + n);
}
