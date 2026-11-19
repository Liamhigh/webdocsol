import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const QPDF_WASM_MAX_MEMORY_PAGES = 4096;
const ORIGINAL_MAX_MEMORY_PAGES = 32768;

function readUleb(bytes, offset, end) {
  let value = 0;
  let shift = 0;
  let cursor = offset;
  while (cursor < end && shift < 35) {
    const byte = bytes[cursor++];
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value: value >>> 0, next: cursor };
    shift += 7;
  }
  throw new Error('Invalid unsigned LEB128 value in QPDF-WASM');
}

function writeUleb(value) {
  const bytes = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value) byte |= 0x80;
    bytes.push(byte);
  } while (value);
  return Uint8Array.from(bytes);
}

function concat(parts) {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function parseMemorySection(bytes) {
  if (bytes.length < 8 || bytes[0] !== 0 || bytes[1] !== 0x61 ||
      bytes[2] !== 0x73 || bytes[3] !== 0x6d) {
    throw new Error('Not a WebAssembly binary');
  }
  let offset = 8;
  while (offset < bytes.length) {
    const sectionStart = offset;
    const id = bytes[offset++];
    const sectionSize = readUleb(bytes, offset, bytes.length);
    const payloadStart = sectionSize.next;
    const payloadEnd = payloadStart + sectionSize.value;
    if (payloadEnd > bytes.length) throw new Error('Truncated WebAssembly section');
    if (id === 5) {
      const count = readUleb(bytes, payloadStart, payloadEnd);
      if (count.value !== 1) throw new Error('Expected exactly one QPDF-WASM memory');
      const flags = readUleb(bytes, count.next, payloadEnd);
      if (flags.value !== 1) throw new Error('Expected a bounded 32-bit QPDF-WASM memory');
      const minimum = readUleb(bytes, flags.next, payloadEnd);
      const maximum = readUleb(bytes, minimum.next, payloadEnd);
      if (maximum.next !== payloadEnd) throw new Error('Unexpected bytes in QPDF-WASM memory section');
      return {
        sectionStart,
        payloadStart,
        payloadEnd,
        count: count.value,
        flags: flags.value,
        minimumPages: minimum.value,
        maximumPages: maximum.value
      };
    }
    offset = payloadEnd;
  }
  throw new Error('QPDF-WASM has no memory section');
}

export function getQpdfWasmMemoryLimits(bytes) {
  const section = parseMemorySection(bytes);
  return {
    minimumPages: section.minimumPages,
    maximumPages: section.maximumPages
  };
}

export function limitQpdfWasmMemory(input, maximumPages = QPDF_WASM_MAX_MEMORY_PAGES) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const section = parseMemorySection(bytes);
  if (!Number.isInteger(maximumPages) || maximumPages < section.minimumPages ||
      maximumPages > section.maximumPages) {
    throw new RangeError('QPDF-WASM maximum memory must be between its initial and original limits');
  }
  if (section.maximumPages !== ORIGINAL_MAX_MEMORY_PAGES &&
      section.maximumPages !== maximumPages) {
    throw new Error('Unexpected upstream QPDF-WASM memory maximum');
  }
  const payload = concat([
    writeUleb(section.count),
    writeUleb(section.flags),
    writeUleb(section.minimumPages),
    writeUleb(maximumPages)
  ]);
  const replacement = concat([
    Uint8Array.of(5),
    writeUleb(payload.length),
    payload
  ]);
  return concat([
    bytes.slice(0, section.sectionStart),
    replacement,
    bytes.slice(section.payloadEnd)
  ]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath || process.argv.length !== 4) {
    throw new Error('Usage: node scripts/limit-qpdf-wasm-memory.mjs <input.wasm> <output.wasm>');
  }
  const input = await readFile(inputPath);
  await writeFile(outputPath, limitQpdfWasmMemory(input));
}
