// Stream's externs (m1b-extern.md §H8 step 6). A stream is a web stream and
// crosses at a type variable (D200), so `Bytes` inside one is converted here,
// from a `DataView` to a `Uint8Array` on the way in and back on the way out, as
// the kernel did. Errors are built by the Geng constructors each declaration is
// handed (D192).

function cancellationErrorString(err) {
  if (err instanceof Error) {
    return err.toString();
  }

  if (typeof err === "string") {
    return err;
  }

  return "Unknown error";
}

function toDataView(value) {
  if (value instanceof Uint8Array) {
    return new DataView(value.buffer, value.byteOffset, value.byteLength);
  }
  return value;
}

function toUint8Array(value) {
  if (value instanceof DataView) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return value;
}

function read(locked, closed, cancelled, stream, succeed, fail) {
  if (stream.locked) {
    return fail(locked);
  }

  const reader = stream.getReader();
  reader
    .read()
    .then(({ done, value }) => {
      reader.releaseLock();

      if (done) {
        return fail(closed);
      }

      succeed(toDataView(value));
    })
    .catch((err) => {
      reader.releaseLock();
      fail(cancelled(cancellationErrorString(err)));
    });
}

function write(locked, cancelled, value, stream, succeed, fail) {
  if (stream.locked) {
    return fail(locked);
  }

  value = toUint8Array(value);

  const writer = stream.getWriter();
  writer.ready
    .then(() => {
      const writePromise = writer.write(value);
      writer.releaseLock();
      return writePromise;
    })
    .then(() => {
      succeed(stream);
    })
    .catch((err) => {
      fail(cancelled(cancellationErrorString(err)));
    });
}

function enqueue(locked, value, stream, succeed, fail) {
  if (stream.locked) {
    return fail(locked);
  }

  value = toUint8Array(value);

  const writer = stream.getWriter();
  writer.ready.then(() => {
    writer.write(value);
    writer.releaseLock();

    succeed(stream);
  });
}

function cancelReadable(locked, reason, stream, succeed, fail) {
  if (stream.locked) {
    return fail(locked);
  }

  stream.cancel(reason).then(() => {
    succeed();
  });
}

function cancelWritable(locked, reason, stream, succeed, fail) {
  if (stream.locked) {
    return fail(locked);
  }

  stream.abort(reason).then(() => {
    succeed();
  });
}

function closeWritable(locked, cancelled, stream, succeed, fail) {
  if (stream.locked) {
    return fail(locked);
  }

  const writer = stream.getWriter();
  writer
    .close()
    .then(() => {
      writer.releaseLock();
      succeed();
    })
    .catch((err) => {
      writer.releaseLock();
      fail(cancelled(cancellationErrorString(err)));
    });
}

function pipeThrough(locked, transformer, readable, succeed, fail) {
  if (readable.locked || transformer.writable.locked) {
    return fail(locked);
  }

  succeed(readable.pipeThrough(transformer));
}

function pipeTo(locked, cancelled, writable, readable, succeed, fail) {
  if (readable.locked || writable.locked) {
    return fail(locked);
  }

  readable
    .pipeTo(writable)
    .then(() => {
      succeed();
    })
    .catch((err) => {
      fail(cancelled(cancellationErrorString(err)));
    });
}

function identityTransformation(readCapacity, writeCapacity, succeed, fail) {
  succeed(
    new TransformStream(
      {},
      new CountQueuingStrategy({ highWaterMark: writeCapacity }),
      new CountQueuingStrategy({ highWaterMark: readCapacity }),
    ),
  );
}

// `step` answers a record the implementation cannot read, so it is read through
// the four functions after it.
function customTransformation(
  step,
  ctorOf,
  stateOf,
  sendOf,
  cancelReasonOf,
  initState,
  readCapacity,
  writeCapacity,
  succeed,
  fail,
) {
  const transformStream = new TransformStream(
    {
      start() {
        this.state = initState;
      },
      transform(chunk, controller) {
        const action = step(this.state, toDataView(chunk));
        switch (ctorOf(action)) {
          case "UpdateState":
            this.state = stateOf(action);
            break;
          case "Send":
            this.state = stateOf(action);
            for (let value of sendOf(action)) {
              controller.enqueue(toUint8Array(value));
            }
            break;
          case "Close":
            for (let value of sendOf(action)) {
              controller.enqueue(toUint8Array(value));
            }
            controller.terminate();
            break;
          case "Cancel":
            controller.error(cancelReasonOf(action));
            break;
        }
      },
    },
    new CountQueuingStrategy({ highWaterMark: writeCapacity }),
    new CountQueuingStrategy({ highWaterMark: readCapacity }),
  );

  succeed(transformStream);
}

function readable(transformStream) {
  return transformStream.readable;
}

function writable(transformStream) {
  return transformStream.writable;
}

function textEncoder(succeed, fail) {
  succeed(new TextEncoderStream());
}

function textDecoder(succeed, fail) {
  succeed(new TextDecoderStream());
}

function compressor(algo, succeed, fail) {
  succeed(new CompressionStream(algo));
}

function decompressor(algo, succeed, fail) {
  succeed(new DecompressionStream(algo));
}
