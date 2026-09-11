import { claimTask } from "../src/index.ts";
import { graphIndex, initialNow } from "./helpers.ts";

export const leaseUuidA = "00000000-0000-4000-8000-000000000101";
export const leaseUuidB = "00000000-0000-4000-8000-000000000102";

export function claim(
  index: ReturnType<typeof graphIndex>,
  taskId: string,
  leaseUuid = leaseUuidA,
  now = initialNow
) {
  return claimTask(
    index,
    {
      taskId,
      actor: "test-worker",
      leaseUuid
    },
    now
  );
}
