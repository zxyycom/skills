### Case DECISION-CLI-NEW-HELP-001: New 帮助固定显式 scaffold 输入

Tests:
- `test:61e79f26d7446ff6ad10a1e1e76bc3864c7a8194cb40efe235e6169f877aa06d`

Tags:
- `decision-records`

Contract:
- `new` 只接收创建 scaffold 所需的显式 metadata、可选直接关系和可选预演 alignment；它不得接收建立用的 `--alignment`。

Proves:
- 帮助公开 title、purpose、background、decision、重复 tag、重复 relation 与 preflight alignment。
- relation 明确声明当前 candidate 的完整直接前序集合，而不误称为已选后继的覆盖。
- 帮助区分 scaffold/body readiness 的机械含义，并且不公开生命周期 alignment 选项。
