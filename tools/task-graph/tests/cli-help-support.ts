import assert from "node:assert/strict";
import { withTempWorkspace } from "./helpers.ts";
import {
  callCli,
  requireRecord,
  requireRecords,
  requireString,
  requireStrings
} from "./cli-test-support.ts";

async function verifyEveryCommandHelp(root: string): Promise<void> {
  const rootHelp = await callCli(root, []);
  assert.equal(rootHelp.result.ok, true);
  if (!rootHelp.result.ok) return;
  const rootHelpData = requireRecord(rootHelp.result.data, "root help data");
  const commands = requireStrings(
    rootHelpData.commands,
    "root help data.commands"
  );
  for (const command of commands) {
    const commandHelp = await callCli(root, [...command.split(" "), "--help"]);
    assert.equal(commandHelp.result.ok, true);
    if (commandHelp.result.ok) {
      const data = requireRecord(
        commandHelp.result.data,
        `${command} help data`
      );
      assert.equal(data.command, command);
      assert.equal(typeof data.requiresMutationRuntime, "boolean");
    }
  }
}

export async function verifyCommandHelp(): Promise<void> {
  await withTempWorkspace(async (root) => {
    await verifyEveryCommandHelp(root);
    const removeHelp = await callCli(root, ["task", "remove", "--help"]);
    assert.equal(removeHelp.result.ok, true);
    if (removeHelp.result.ok) {
      const data = requireRecord(
        removeHelp.result.data,
        "task remove help data"
      );
      const parameters = requireRecord(
        data.parameters,
        "task remove help parameters"
      );
      const options = requireRecords(
        parameters.options,
        "task remove help options"
      );
      assert.equal(data.command, "task remove");
      assert.match(
        requireString(data.usage, "task remove help usage"),
        /--expected-revision/u
      );
      assert.deepEqual(
        options.find((option) => option.name === "--task"),
        { name: "--task", required: true, type: "string", multiple: true }
      );
    }

    const taskCreateHelp = await callCli(root, ["task", "create", "--help"]);
    assert.equal(taskCreateHelp.result.ok, true);
    if (taskCreateHelp.result.ok) {
      const data = requireRecord(
        taskCreateHelp.result.data,
        "task create help data"
      );
      assert.equal(data.requiresMutationRuntime, true);
      const parameters = requireRecord(
        data.parameters,
        "task create help parameters"
      );
      const options = requireRecords(
        parameters.options,
        "task create help options"
      );
      assert.deepEqual(
        options.find((option) => option.name === "--acceptance"),
        {
          name: "--acceptance",
          required: false,
          type: "string",
          multiple: true
        }
      );
    }

    const indexStageHelp = await callCli(root, ["index", "stage", "--help"]);
    assert.equal(indexStageHelp.result.ok, true);
    if (indexStageHelp.result.ok) {
      const data = requireRecord(
        indexStageHelp.result.data,
        "index stage help data"
      );
      assert.equal(data.requiresMutationRuntime, false);
      assert.equal(
        data.usage,
        "task-graph index stage --task <id> [--task <id>...]"
      );
      const parameters = requireRecord(
        data.parameters,
        "index stage help parameters"
      );
      const options = requireRecords(
        parameters.options,
        "index stage help options"
      );
      assert.deepEqual(
        options.find((option) => option.name === "--task"),
        { name: "--task", required: true, type: "string", multiple: true }
      );
    }

    const applyHelp = await callCli(root, ["help", "apply"]);
    assert.equal(applyHelp.result.ok, true);
    if (applyHelp.result.ok) {
      const data = requireRecord(applyHelp.result.data, "apply help data");
      const parameters = requireRecord(
        data.parameters,
        "apply help parameters"
      );
      assert.deepEqual(parameters.input, {
        default: "stdin",
        fileOption: "--file",
        format: "json"
      });
    }
  });
}
