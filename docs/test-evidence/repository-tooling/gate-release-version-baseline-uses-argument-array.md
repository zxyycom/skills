### Case GATE-RELEASE-VERSION-ARGS-001: release 基线通过 Bun 参数数组传递

Entry:
- `scripts/vibe-check.test.ts > release version validation passes its baseline through Bun argument arrays`
- `bun test --test-name-pattern="^release version validation passes its baseline through Bun argument arrays$" ./scripts/vibe-check.test.ts`

Contract:
- `release:skill-version` 必须将 baseline 作为 `bun run hash:skills` 的单个参数元素传递，不能拼接 shell 命令字符串。

Proves:
- 含 shell 元字符的 fixture baseline 原样成为 capture script 的一个 argv 元素，并保留 `--baseline-ref` 与 `--quiet` 顺序。
- 该字符串没有创建其试图注入的文件，full aggregate 仍可完成。
