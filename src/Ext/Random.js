// Random's one extern (m1b-source.md §SO16): portable-core.md P1's OS entropy,
// two whole 32-bit words that Random.gren makes a seed of.

function entropy(build, succeed, fail) {
  var words = new Uint32Array(2);
  globalThis.crypto.getRandomValues(words);
  succeed(build(words[0], words[1]));
}
