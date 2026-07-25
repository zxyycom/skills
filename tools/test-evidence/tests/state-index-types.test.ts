import type {
  TestEvidenceStateIndex as MaintainedTestEvidenceStateIndex
} from "../api/test-evidence-state-index.types.mjs";
import type {
  TestEvidenceStateIndex as DistributedTestEvidenceStateIndex
} from "../../../skills/test-evidence-review/scripts/test-evidence-state-index.types.mjs";

type MaintainedMetadata = MaintainedTestEvidenceStateIndex["metadata"];
type DistributedMetadata = DistributedTestEvidenceStateIndex["metadata"];

const maintainedMetadata: MaintainedMetadata = {};
const distributedMetadata: DistributedMetadata = maintainedMetadata;
const maintainedRoundTrip: MaintainedMetadata = distributedMetadata;
void maintainedRoundTrip;

if (false) {
  // @ts-expect-error Empty metadata rejects additional properties.
  const maintainedWithField: MaintainedMetadata = { unexpected: true };
  // @ts-expect-error Empty metadata rejects arrays.
  const maintainedArray: MaintainedMetadata = ["unexpected"];
  // @ts-expect-error Empty metadata rejects primitive values.
  const maintainedPrimitive: MaintainedMetadata = "unexpected";
  // @ts-expect-error Distributed metadata rejects additional properties.
  const distributedWithField: DistributedMetadata = { unexpected: true };
  // @ts-expect-error Distributed metadata rejects arrays.
  const distributedArray: DistributedMetadata = ["unexpected"];
  // @ts-expect-error Distributed metadata rejects primitive values.
  const distributedPrimitive: DistributedMetadata = 1;
  void [
    maintainedWithField,
    maintainedArray,
    maintainedPrimitive,
    distributedWithField,
    distributedArray,
    distributedPrimitive
  ];
}
