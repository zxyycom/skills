export type LedgerTextSource = {
  path: string;
  text: string;
};

export function decodeLedgerUtf8Text(data: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(data);
}
