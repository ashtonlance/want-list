// Principal component analysis and int8 quantization for art fingerprints. Pure functions, no deps.

/** Mean and top `dims` principal axes of `n` row vectors of length `width` (row-major Float32Array). */
export function fitPca(rows, n, width, dims, iterations = 80) {
  const mean = new Float64Array(width);
  for (let i = 0; i < n; i++) for (let j = 0; j < width; j++) mean[j] += rows[i * width + j];
  for (let j = 0; j < width; j++) mean[j] /= n;

  // Covariance, upper triangle then mirrored.
  const cov = new Float64Array(width * width);
  const x = new Float64Array(width);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < width; j++) x[j] = rows[i * width + j] - mean[j];
    for (let a = 0; a < width; a++) {
      const xa = x[a];
      if (xa === 0) continue;
      const base = a * width;
      for (let b = a; b < width; b++) cov[base + b] += xa * x[b];
    }
  }
  for (let a = 0; a < width; a++)
    for (let b = a; b < width; b++) {
      const v = cov[a * width + b] / n;
      cov[a * width + b] = v;
      cov[b * width + a] = v;
    }

  // Orthogonal iteration: repeatedly multiply a basis by the covariance and re-orthonormalize it.
  let q = new Float64Array(width * dims);
  let seed = 12345;
  const rand = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32) - 0.5;
  for (let i = 0; i < q.length; i++) q[i] = rand();
  orthonormalize(q, width, dims);
  const z = new Float64Array(width * dims);
  for (let it = 0; it < iterations; it++) {
    z.fill(0);
    for (let a = 0; a < width; a++) {
      const base = a * width;
      for (let b = 0; b < width; b++) {
        const c = cov[base + b];
        if (c === 0) continue;
        for (let k = 0; k < dims; k++) z[a * dims + k] += c * q[b * dims + k];
      }
    }
    q = z.slice();
    orthonormalize(q, width, dims);
  }

  // Order the axes by the variance they carry, largest first.
  const variance = [];
  for (let k = 0; k < dims; k++) {
    let v = 0;
    for (let a = 0; a < width; a++) {
      let s = 0;
      for (let b = 0; b < width; b++) s += cov[a * width + b] * q[b * dims + k];
      v += q[a * dims + k] * s;
    }
    variance.push({ k, v });
  }
  variance.sort((p, r) => r.v - p.v);
  const axes = new Float32Array(dims * width); // row k = axis k
  variance.forEach(({ k }, row) => {
    for (let a = 0; a < width; a++) axes[row * width + a] = q[a * dims + k];
  });
  let total = 0;
  for (let a = 0; a < width; a++) total += cov[a * width + a];
  const kept = variance.reduce((s, x) => s + x.v, 0) / (total || 1);
  return { mean: Float32Array.from(mean), axes, dims, width, kept };
}

/** Modified Gram-Schmidt on the `dims` columns of a width x dims matrix, in place. */
function orthonormalize(q, width, dims) {
  for (let k = 0; k < dims; k++) {
    for (let j = 0; j < k; j++) {
      let dot = 0;
      for (let a = 0; a < width; a++) dot += q[a * dims + k] * q[a * dims + j];
      for (let a = 0; a < width; a++) q[a * dims + k] -= dot * q[a * dims + j];
    }
    let norm = 0;
    for (let a = 0; a < width; a++) norm += q[a * dims + k] ** 2;
    norm = Math.sqrt(norm) || 1;
    for (let a = 0; a < width; a++) q[a * dims + k] /= norm;
  }
}

/** Projects one vector onto the PCA axes, scales it to unit length and rounds it to int8. */
export function project(pca, vec, out = new Int8Array(pca.dims)) {
  const y = new Float64Array(pca.dims);
  let norm = 0;
  for (let k = 0; k < pca.dims; k++) {
    let s = 0;
    for (let a = 0; a < pca.width; a++) s += (vec[a] - pca.mean[a]) * pca.axes[k * pca.width + a];
    y[k] = s;
    norm += s * s;
  }
  norm = Math.sqrt(norm) || 1;
  for (let k = 0; k < pca.dims; k++) out[k] = Math.max(-127, Math.min(127, Math.round((y[k] / norm) * 127)));
  return out;
}

/** pca.bin: "PCA1", uint16 dims, uint16 width, then mean (width float32) and axes (dims x width float32). */
export function encodePca(pca) {
  const buf = Buffer.alloc(8 + 4 * (pca.width + pca.dims * pca.width));
  buf.write("PCA1", 0, "ascii");
  buf.writeUInt16LE(pca.dims, 4);
  buf.writeUInt16LE(pca.width, 6);
  Buffer.from(pca.mean.buffer, pca.mean.byteOffset, pca.mean.byteLength).copy(buf, 8);
  Buffer.from(pca.axes.buffer, pca.axes.byteOffset, pca.axes.byteLength).copy(buf, 8 + 4 * pca.width);
  return buf;
}

export function decodePca(buf) {
  if (buf.toString("ascii", 0, 4) !== "PCA1") throw new Error("pca.bin: bad header");
  const dims = buf.readUInt16LE(4), width = buf.readUInt16LE(6);
  const floats = new Float32Array(buf.buffer.slice(buf.byteOffset + 8, buf.byteOffset + buf.length));
  return { dims, width, mean: floats.slice(0, width), axes: floats.slice(width, width + dims * width) };
}

/**
 * art.bin, the file the app loads: "ART1", uint8 format version, uint8 dims, uint16 zero, uint32 count,
 * then count uint32 product ids in ascending order, then count x dims int8 vectors in the same order.
 */
export function encodeArt(dims, entries) {
  const sorted = [...entries].sort((a, b) => a[0] - b[0]);
  const n = sorted.length;
  const buf = Buffer.alloc(12 + n * 4 + n * dims);
  buf.write("ART1", 0, "ascii");
  buf.writeUInt8(1, 4);
  buf.writeUInt8(dims, 5);
  buf.writeUInt32LE(n, 8);
  sorted.forEach(([pid, vec], i) => {
    buf.writeUInt32LE(pid, 12 + i * 4);
    Buffer.from(vec.buffer, vec.byteOffset, dims).copy(buf, 12 + n * 4 + i * dims);
  });
  return buf;
}

export function decodeArt(buf) {
  if (buf.toString("ascii", 0, 4) !== "ART1") throw new Error("art.bin: bad header");
  const dims = buf.readUInt8(5), n = buf.readUInt32LE(8);
  const out = new Map();
  for (let i = 0; i < n; i++) {
    const at = 12 + n * 4 + i * dims;
    out.set(buf.readUInt32LE(12 + i * 4), new Int8Array(buf.subarray(at, at + dims)));
  }
  return { dims, vectors: out };
}
