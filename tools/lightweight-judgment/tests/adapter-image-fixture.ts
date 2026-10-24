import { deflateSync } from "node:zlib";

function pngChunk(name: string, data: Buffer): Buffer {
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length);
  result.write(name, 4, "ascii");
  data.copy(result, 8);
  let crc = 0xffffffff;
  for (const byte of result.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
  return result;
}
export function pngFixture(width: number, height: number, textLength = 0) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const pixels = Buffer.alloc(height * (width * 3 + 1));
  let random = 0x13579bdf;
  for (let row = 0; row < height; row++) {
    for (let column = 1; column <= width * 3; column++) {
      random ^= random << 13;
      random ^= random >>> 17;
      random ^= random << 5;
      pixels[row * (width * 3 + 1) + column] = random & 255;
    }
  }
  const compressed = deflateSync(pixels);
  const bytes = Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", header),
    pngChunk("tEXt", Buffer.from(`fixture\0${"x".repeat(textLength)}`)),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
  return { bytes, compressed, pixels };
}
export function imageRequest(base64: string): string {
  return JSON.stringify({
    state: {
      type: "image_url",
      image_url: { url: `data:image/png;base64,${base64}` }
    },
    questions: {
      answer: { type: "noul", instructions: "Is there a visible target?" }
    }
  });
}
