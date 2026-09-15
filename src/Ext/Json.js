// Json's fast path for `decodeString` on JavaScript (m1b-json.md §O16, D215,
// D222–D227). `JSON.parse` reads the text, and a walk hands each value to the
// Geng builder for its constructor, so the tree is the one `Json.Value`'s own
// parser builds, and nothing here names a constructor (D192).
//
// It answers what the Geng parser answers on every input, and gives the text
// back to it, by returning `notFound`, on exactly three things (D224):
//
//   - `JSON.parse` fails. The message is the Geng parser's (D217).
//   - An object's first key is an array index. JavaScript orders an object's
//     own keys with every array index first, ascending, and the rest in
//     creation order, so the first key is the only one to look at: if it is not
//     an index, none is. Source order is D213's.
//   - The walk runs out of stack, somewhere past 1,000 levels.
//
// What `JSON.parse` already does as §O7 says, it is left to do: a duplicate key
// keeps its last value at its first position (D213), a number is the correctly
// rounded double with `-0` and the overflows (D214), and `__proto__` is an own
// member. A lone surrogate, in a key or a value, becomes U+FFFD (D209). The
// builders' parameters are type variables, which cross unchecked (D223), so
// every string handed over is made well formed here.

var _Json_GAVE_UP = {};

// A canonical decimal below 2^32 - 1, which is what an array index is.
function _Json_isIndex(key) {
  var length = key.length;
  if (length === 0 || length > 10) return false;
  var c = key.charCodeAt(0);
  if (c < 48 || c > 57) return false;
  if (c === 48) return length === 1;
  for (var i = 1; i < length; i++) {
    var d = key.charCodeAt(i);
    if (d < 48 || d > 57) return false;
  }
  return Number(key) < 4294967295;
}

function _Json_wellFormed(s) {
  return s.isWellFormed() ? s : s.toWellFormed();
}

function parseWith(nul, bool, number, string, array, object, found, notFound, text) {
  function walk(v) {
    if (v === null) return nul;
    switch (typeof v) {
      case "boolean":
        return bool(v);
      case "number":
        return number(v);
      case "string":
        return string(_Json_wellFormed(v));
    }
    if (Array.isArray(v)) {
      var length = v.length;
      var items = new Array(length);
      for (var i = 0; i < length; i++) {
        var item = walk(v[i]);
        if (item === _Json_GAVE_UP) return _Json_GAVE_UP;
        items[i] = item;
      }
      return array(items);
    }
    var keys = [];
    var values = [];
    for (var key in v) {
      if (keys.length === 0 && _Json_isIndex(key)) return _Json_GAVE_UP;
      var value = walk(v[key]);
      if (value === _Json_GAVE_UP) return _Json_GAVE_UP;
      keys.push(_Json_wellFormed(key));
      values.push(value);
    }
    return object(keys, values);
  }

  var parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return notFound;
  }
  var tree;
  try {
    tree = walk(parsed);
  } catch (e) {
    // A RangeError, from a walk deeper than the stack.
    return notFound;
  }
  return tree === _Json_GAVE_UP ? notFound : found(tree);
}
