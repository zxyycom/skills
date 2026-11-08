import assert from "node:assert/strict";
import { test } from "node:test";
import { isLockedFileFailure } from "../ci-bootstrap-lock.ts";

test("Windows lock evidence requires an access error for the actual executable", () => {
  const binary = "C:\\fixture\\bin\\decision-records.exe";
  const sharing = {
    code: "EPERM",
    path: "C:\\fixture\\stage\\prepared",
    dest: binary
  };
  assert.equal(
    isLockedFileFailure(new Error("restored", { cause: sharing }), binary),
    true
  );
  assert.equal(
    isLockedFileFailure(
      { code: "EACCES", path: "c:\\FIXTURE\\bin\\decision-records.exe" },
      binary
    ),
    true
  );
  assert.equal(
    isLockedFileFailure({ code: "ENOENT", path: binary }, binary),
    false
  );
  assert.equal(
    isLockedFileFailure({ code: "EBUSY", path: "C:\\fixture\\other" }, binary),
    false
  );
  assert.equal(isLockedFileFailure(new Error("unrelated"), binary), false);
});
