import { testMaterialization } from "./materialization.test.ts";
import { testPerformance } from "./performance.test.ts";
import { testQueries } from "./query.test.ts";
import { testRuntime } from "./runtime.test.ts";

await testMaterialization();
await testQueries();
await testRuntime();
await testPerformance();

console.log("Index runtime tests passed.");
