/*

import Gren.Kernel.Debug exposing (crash)
import Json.Value as Value exposing (Null, Bool, Number, Str, Arr, Obj, foldHost)

*/

// What is left of the platform runtime once effect managers, ports and
// `Program` have gone (geng-lang m1b-source.md §SO19): JSON at the host
// boundary, which `node`'s Sqlite kernel still uses, and the export every
// emitted program calls to put its `init` in `scope.Gren`.

// JSON AT THE BOUNDARY

// A JavaScript value becomes a Json.Value.Value by what JSON.stringify would
// keep of it (m1b-json.md §O10, D220): `toJSON` is called, a boxed primitive is
// its primitive, a number that is not finite is null, `undefined`, a function
// and a symbol are null in an array and absent from an object, and `undefined`
// at the top is null. A string's lone surrogates become U+FFFD, since a String
// holds none (D209). A BigInt is refused, as JSON.stringify refuses it.

function _Platform_jsonFromHost(value) {
  var json = _Platform_jsonFromHostOrSkip(value, "");
  return json === undefined ? __Value_Null : json;
}

function _Platform_jsonFromHostOrSkip(value, key) {
  if (
    value !== null &&
    (typeof value === "object" || typeof value === "bigint") &&
    typeof value.toJSON === "function"
  ) {
    value = value.toJSON(key);
  }

  if (
    value instanceof Number ||
    value instanceof String ||
    value instanceof Boolean
  ) {
    value = value.valueOf();
  }

  switch (typeof value) {
    case "boolean":
      return __Value_Bool(value);
    case "number":
      return isFinite(value) ? __Value_Number(value) : __Value_Null;
    case "string":
      return __Value_Str(value.isWellFormed() ? value : value.toWellFormed());
    case "bigint":
      throw new TypeError("Do not know how to serialize a BigInt");
    case "undefined":
    case "function":
    case "symbol":
      return undefined;
  }

  if (value === null) {
    return __Value_Null;
  }

  if (Array.isArray(value)) {
    var items = new Array(value.length);
    for (var i = 0; i < value.length; i++) {
      var item = _Platform_jsonFromHostOrSkip(value[i], String(i));
      items[i] = item === undefined ? __Value_Null : item;
    }
    return __Value_Arr(items);
  }

  var members = [];
  var keys = Object.keys(value);
  for (var k = 0; k < keys.length; k++) {
    var member = _Platform_jsonFromHostOrSkip(value[keys[k]], keys[k]);
    if (member !== undefined) {
      members.push({ __$key: keys[k], __$value: member });
    }
  }
  return __Value_Obj(members);
}

// A Json.Value.Value becomes plain JavaScript: null, a boolean, a number, a
// string, an array or an object. A member is defined rather than assigned, so
// that a key named `__proto__` is a member like any other.

var _Platform_jsonBuilders = {
  __$null: null,
  __$bool: function (b) {
    return b;
  },
  __$number: function (n) {
    return n;
  },
  __$string: function (s) {
    return s;
  },
  __$array: function (items) {
    return items;
  },
  __$object: function (members) {
    var object = {};
    for (var i = 0; i < members.length; i++) {
      Object.defineProperty(object, members[i].__$key, {
        value: members[i].__$value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    return object;
  },
};

function _Platform_jsonToHost(value) {
  return A2(__Value_foldHost, _Platform_jsonBuilders, value);
}

// EXPORT GREN MODULES
//
// Have DEBUG and PROD versions so that we can (1) give nicer errors in
// debug mode and (2) not pay for the bits needed for that in prod mode.
//

function _Platform_export__PROD(exports) {
  scope["Gren"]
    ? _Platform_mergeExportsProd(scope["Gren"], exports)
    : (scope["Gren"] = exports);
}

function _Platform_mergeExportsProd(obj, exports) {
  for (var name in exports) {
    name in obj
      ? name == "init"
        ? __Debug_crash(6)
        : _Platform_mergeExportsProd(obj[name], exports[name])
      : (obj[name] = exports[name]);
  }
}

function _Platform_export__DEBUG(exports) {
  scope["Gren"]
    ? _Platform_mergeExportsDebug("Gren", scope["Gren"], exports)
    : (scope["Gren"] = exports);
}

function _Platform_mergeExportsDebug(moduleName, obj, exports) {
  for (var name in exports) {
    name in obj
      ? name == "init"
        ? __Debug_crash(6, moduleName)
        : _Platform_mergeExportsDebug(
            moduleName + "." + name,
            obj[name],
            exports[name],
          )
      : (obj[name] = exports[name]);
  }
}
