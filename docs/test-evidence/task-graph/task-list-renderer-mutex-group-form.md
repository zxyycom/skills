### Case TASK-GRAPH-LIST-MUTEX-FORM-001: Run mutex group 按 columns 与 endpoint 数量选择 form

Entry:
- `tools/task-graph/tests/task-list-renderer.test.ts > task-list run-mutex group form uses columns and endpoint count thresholds`
- `bun test --test-name-pattern="^task-list run-mutex group form uses columns and endpoint count thresholds$" ./tools/task-graph/tests/run.ts`

Contract:
- RUN MUTEX group 在 columns 至少 80 且 right endpoint 不超过三个时使用 inline form；columns 较窄或 endpoint 超过三个时使用 block form。

Proves:
- 两个乱序 endpoint 在 columns 80 按 task ID 排序后同行显示，在 columns 79 改为逐 endpoint continuation。
- 四个乱序 endpoint 即使 columns 80 也按 T02 至 T05 的稳定顺序使用 block continuation。
