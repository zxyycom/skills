import { afterEach } from "node:test";
import {
  createBridgeFixture,
  fixtureSsh,
  type BridgeFixture
} from "./support.ts";

const fixtures: BridgeFixture[] = [];
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((value) => value.cleanup()));
});

export async function fixture(): Promise<BridgeFixture> {
  const value = await createBridgeFixture();
  fixtures.push(value);
  return value;
}

export function runtime(
  value: BridgeFixture,
  timeoutMs?: number
): Readonly<{ sshExecutable: string; timeoutMs?: number }> {
  return {
    sshExecutable: fixtureSsh(value),
    ...(timeoutMs === undefined ? {} : { timeoutMs })
  };
}
