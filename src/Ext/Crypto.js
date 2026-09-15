// Crypto's externs (m1b-extern.md §H8 step 6). Each was a kernel function, and
// each still calls Web Crypto as that function did. What changed is what
// crosses (D192): a key is the host's `CryptoKey`, described to the Geng
// function each declaration hands in; an error is a constructor handed in; an
// optional argument is a flag or a zero; and a JSON Web Key is its text.

var impl = typeof window === "undefined" ? require("crypto") : window.crypto;

// A key's own description, in the order `Crypto.gren`'s `…FromHost` functions
// take it. A field the algorithm does not have is 0 or "".
function describe(build, key) {
  var algorithm = key.algorithm;
  return build(
    key,
    algorithm.modulusLength ?? 0,
    algorithm.hash ? algorithm.hash.name : "",
    algorithm.namedCurve ?? "",
    algorithm.length ?? 0,
    key.extractable,
  );
}

// The algorithm object each generate and import call builds, with a field left
// out where the kernel left it out: when it was not the algorithm's, or when
// the kernel was handed "" for it.
function algorithmOf(name, modulusLength, publicExponent, hash, namedCurve, length) {
  var algorithm = { name: name };
  if (modulusLength !== 0) {
    algorithm.modulusLength = modulusLength;
  }
  if (publicExponent.length !== 0) {
    algorithm.publicExponent = new Uint8Array(publicExponent);
  }
  if (hash !== "") {
    algorithm.hash = hash;
  }
  if (namedCurve !== "") {
    algorithm.namedCurve = namedCurve;
  }
  if (length !== 0) {
    algorithm.length = length;
  }
  return algorithm;
}

function unforeseen(what) {
  return (
    "There was an unforseen error that occured when attempting " +
    what +
    ". This shouldn't happen! Please file a ticket in the `gren-lang/core` Github repo (https://github.com/gren-lang/core)"
  );
}

// The kernel's messages named the kind of key.
function kindOfKey(name) {
  switch (name) {
    case "AES-CTR":
    case "AES-CBC":
    case "AES-GCM":
      return "an AES key";
    case "ECDSA":
      return "an EC key";
    case "HMAC":
      return "an HMAC key";
    default:
      return "an RSA key";
  }
}

// Random

function randomUUID(succeed, fail) {
  succeed(impl.randomUUID());
}

function getRandomValues(arrayLength, valueType, succeed, fail) {
  var array;
  switch (valueType) {
    case "int8":
      array = new Int8Array(arrayLength);
      break;
    case "uint8":
      array = new Uint8Array(arrayLength);
      break;
    case "int16":
      array = new Int16Array(arrayLength);
      break;
    case "uint16":
      array = new Uint16Array(arrayLength);
      break;
    case "int32":
      array = new Int32Array(arrayLength);
      break;
    case "uint32":
      array = new Uint32Array(arrayLength);
      break;
    default:
      array = new Int8Array(0);
      break;
  }
  var randomValues = impl.getRandomValues(array);
  succeed(new Uint8Array(randomValues.buffer));
}

// Context

function getContext(context, succeed, fail) {
  if (impl.subtle) {
    return succeed(context);
  }
  fail();
}

// Generate keys

function generateKey(build, name, modulusLength, publicExponent, hash, namedCurve, length, extractable, usages, succeed, fail) {
  impl.subtle
    .generateKey(
      algorithmOf(name, modulusLength, publicExponent, hash, namedCurve, length),
      extractable,
      usages,
    )
    .then(function (key) {
      succeed(describe(build, key));
    })
    .catch(function (err) {
      throw unforeseen("to generate " + kindOfKey(name));
    });
}

function generateKeyPair(build, pair, name, modulusLength, publicExponent, hash, namedCurve, length, extractable, usages, succeed, fail) {
  impl.subtle
    .generateKey(
      algorithmOf(name, modulusLength, publicExponent, hash, namedCurve, length),
      extractable,
      usages,
    )
    .then(function (key) {
      succeed(pair(describe(build, key.publicKey), describe(build, key.privateKey)));
    })
    .catch(function (err) {
      throw unforeseen("to generate " + kindOfKey(name));
    });
}

function generateEd25519KeyPair(build, pair, notSupported, extractable, usages, succeed, fail) {
  impl.subtle
    .generateKey({ name: "Ed25519" }, extractable, usages)
    .then(function (key) {
      succeed(pair(describe(build, key.publicKey), describe(build, key.privateKey)));
    })
    .catch(function (err) {
      fail(notSupported);
    });
}

// Export keys

function exportKey(error, format, key, succeed, fail) {
  impl.subtle
    .exportKey(format, key)
    .then(function (res) {
      succeed(new Uint8Array(res));
    })
    .catch(function (err) {
      fail(error);
    });
}

function exportJwk(error, key, succeed, fail) {
  impl.subtle
    .exportKey("jwk", key)
    .then(function (res) {
      succeed(JSON.stringify(res));
    })
    .catch(function (err) {
      fail(error);
    });
}

// Import keys

function importKey(build, error, format, keyData, name, hash, namedCurve, length, extractable, usages, succeed, fail) {
  impl.subtle
    .importKey(format, keyData, algorithmOf(name, 0, [], hash, namedCurve, length), extractable, usages)
    .then(function (key) {
      succeed(describe(build, key));
    })
    .catch(function (err) {
      fail(error);
    });
}

function importJwk(build, error, jwk, name, hash, namedCurve, length, extractable, usages, succeed, fail) {
  impl.subtle
    .importKey("jwk", JSON.parse(jwk), algorithmOf(name, 0, [], hash, namedCurve, length), extractable, usages)
    .then(function (key) {
      succeed(describe(build, key));
    })
    .catch(function (err) {
      fail(error);
    });
}

// Encryption and decryption

// Each answers a `Uint8Array` over the `ArrayBuffer` Web Crypto gives, which is
// `Bytes` as an extern returns it (D202).
function run(promise, succeed, onError) {
  promise
    .then(function (res) {
      succeed(new Uint8Array(res));
    })
    .catch(onError);
}

function rsaOaep(hasLabel, label) {
  return hasLabel ? { name: "RSA-OAEP", label: label } : { name: "RSA-OAEP" };
}

function aesGcm(iv, hasAdditionalData, additionalData, tagLength) {
  var algorithm = { name: "AES-GCM", iv: iv };
  if (hasAdditionalData) {
    algorithm.additionalData = additionalData;
  }
  if (tagLength !== 0) {
    algorithm.tagLength = tagLength;
  }
  return algorithm;
}

function encryptWithRsaOaep(hasLabel, label, key, bytes, succeed, fail) {
  run(impl.subtle.encrypt(rsaOaep(hasLabel, label), key, bytes), succeed, function (err) {
    throw unforeseen("encrypt some bytes with RSA-OAEP");
  });
}

function decryptWithRsaOaep(error, hasLabel, label, key, bytes, succeed, fail) {
  run(impl.subtle.decrypt(rsaOaep(hasLabel, label), key, bytes), succeed, function (err) {
    fail(error);
  });
}

function encryptWithAesCtr(error, counter, length, key, bytes, succeed, fail) {
  run(impl.subtle.encrypt({ name: "AES-CTR", counter: counter, length: length }, key, bytes), succeed, function (err) {
    fail(error);
  });
}

function decryptWithAesCtr(error, counter, length, key, bytes, succeed, fail) {
  run(impl.subtle.decrypt({ name: "AES-CTR", counter: counter, length: length }, key, bytes), succeed, function (err) {
    fail(error);
  });
}

function encryptWithAesCbc(error, iv, key, bytes, succeed, fail) {
  run(impl.subtle.encrypt({ name: "AES-CBC", iv: iv }, key, bytes), succeed, function (err) {
    fail(error);
  });
}

function decryptWithAesCbc(error, iv, key, bytes, succeed, fail) {
  run(impl.subtle.decrypt({ name: "AES-CBC", iv: iv }, key, bytes), succeed, function (err) {
    fail(error);
  });
}

function encryptWithAesGcm(error, iv, hasAdditionalData, additionalData, tagLength, key, bytes, succeed, fail) {
  run(impl.subtle.encrypt(aesGcm(iv, hasAdditionalData, additionalData, tagLength), key, bytes), succeed, function (err) {
    fail(error);
  });
}

// The kernel turned the bytes into a `Uint8Array` here, because node refused a
// `DataView`. `Bytes` arrives as a `Uint8Array` now (D202).
function decryptWithAesGcm(error, iv, hasAdditionalData, additionalData, tagLength, key, bytes, succeed, fail) {
  run(impl.subtle.decrypt(aesGcm(iv, hasAdditionalData, additionalData, tagLength), key, bytes), succeed, function (err) {
    fail(error);
  });
}

// Signing

function signWithRsaSsaPkcs1V1_5(key, bytes, succeed, fail) {
  run(impl.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, key, bytes), succeed, function (err) {
    throw unforeseen("sign some bytes with RSASSA-PKCS1-v1_5");
  });
}

function signWithRsaPss(error, saltLength, key, bytes, succeed, fail) {
  run(impl.subtle.sign({ name: "RSA-PSS", saltLength: saltLength }, key, bytes), succeed, function (err) {
    fail(error);
  });
}

function signWithEcdsa(hash, key, bytes, succeed, fail) {
  run(impl.subtle.sign({ name: "ECDSA", hash: hash }, key, bytes), succeed, function (err) {
    throw unforeseen("to sign using the ECDSA algorithm");
  });
}

function signWithEd25519(key, bytes, succeed, fail) {
  run(impl.subtle.sign({ name: "Ed25519" }, key, bytes), succeed, function (err) {
    throw unforeseen("to sign using the Ed25519 algorithm");
  });
}

function signWithHmac(key, bytes, succeed, fail) {
  run(impl.subtle.sign({ name: "HMAC" }, key, bytes), succeed, function (err) {
    throw unforeseen("to sign with the HMAC algorithm");
  });
}

// Verify: a signature that does not match fails with `{}`, and the bytes that
// were verified are the answer when it does.

function verify(algorithm, key, signature, bytes, what, succeed, fail) {
  impl.subtle
    .verify(algorithm, key, signature, bytes)
    .then(function (res) {
      if (res) {
        return succeed(bytes);
      }
      return fail();
    })
    .catch(function (err) {
      throw unforeseen("to verify with the " + what + " algorithm");
    });
}

function verifyWithRsaSsaPkcs1V1_5(key, signature, bytes, succeed, fail) {
  verify({ name: "RSASSA-PKCS1-v1_5" }, key, signature, bytes, "RSA-SSA-PKCS v1.5", succeed, fail);
}

function verifyWithRsaPss(saltLength, key, signature, bytes, succeed, fail) {
  verify({ name: "RSA-PSS", saltLength: saltLength }, key, signature, bytes, "RSA-PSS", succeed, fail);
}

function verifyWithEcdsa(hash, key, signature, bytes, succeed, fail) {
  verify({ name: "ECDSA", hash: hash }, key, signature, bytes, "ECDSA", succeed, fail);
}

function verifyWithEd25519(key, signature, bytes, succeed, fail) {
  verify({ name: "Ed25519" }, key, signature, bytes, "Ed25519", succeed, fail);
}

function verifyWithHmac(key, signature, bytes, succeed, fail) {
  verify({ name: "HMAC" }, key, signature, bytes, "HMAC", succeed, fail);
}

// PBKDF2

function deriveBitsWithPbkdf2(error, salt, iterations, hash, length, key, succeed, fail) {
  run(
    impl.subtle.deriveBits({ name: "PBKDF2", salt: salt, iterations: iterations, hash: hash }, key, length),
    succeed,
    function (err) {
      fail(error);
    },
  );
}

// Digest

function digest(algorithm, bytes, succeed, fail) {
  run(impl.subtle.digest(algorithm, bytes), succeed, function (err) {
    throw unforeseen("to digest some bytes");
  });
}
