import { fail } from "./failure.ts";

type Dimensions = Readonly<{ width: number; height: number }>;

function pngDimensions(bytes: Buffer): Dimensions {
  if (
    bytes.length < 33 ||
    bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    bytes.readUInt32BE(8) !== 13 ||
    bytes.toString("ascii", 12, 16) !== "IHDR"
  )
    fail("input", "images", "PNG 文件头或 IHDR 无效");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

type JpegMarker = Readonly<{ marker: number; payloadAt: number }>;

function jpegMarker(bytes: Buffer, at: number): JpegMarker | undefined {
  if (bytes[at++] !== 255) return undefined;
  while (bytes[at] === 255) at++;
  const marker = bytes[at++];
  if (marker === undefined || marker === 217 || marker === 218)
    return undefined;
  return { marker, payloadAt: at };
}

function jpegSegmentLength(bytes: Buffer, at: number): number | undefined {
  if (at + 2 > bytes.length) return undefined;
  const length = bytes.readUInt16BE(at);
  if (length < 2 || at + length > bytes.length) return undefined;
  return length;
}

const jpegFrameMarkers = [
  192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207
];

function standaloneJpegMarker(marker: number): boolean {
  return marker === 1 || (marker >= 208 && marker <= 215);
}

function jpegDimensions(bytes: Buffer): Dimensions {
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216)
    fail("input", "images", "JPEG 文件头无效");
  let at = 2;
  while (at + 4 <= bytes.length) {
    const segment = jpegMarker(bytes, at);
    if (segment === undefined) break;
    const { marker, payloadAt } = segment;
    at = payloadAt;
    if (standaloneJpegMarker(marker)) continue;
    const length = jpegSegmentLength(bytes, at);
    if (length === undefined) break;
    if (jpegFrameMarkers.includes(marker) && length >= 8)
      return {
        width: bytes.readUInt16BE(at + 5),
        height: bytes.readUInt16BE(at + 3)
      };
    at += length;
  }
  return fail("input", "images", "JPEG 缺少有效尺寸信息");
}

export function imageDimensions(
  bytes: Buffer,
  format: "png" | "jpeg"
): Dimensions {
  return format === "png" ? pngDimensions(bytes) : jpegDimensions(bytes);
}
