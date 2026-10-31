import { runPublishSkills } from "./lib/publishing/publish-skills.ts";

process.exitCode = await runPublishSkills();
