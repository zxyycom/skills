### Case DECISION-TYPE-PATH-001: 决策类型与路径保持身份不变量
Entry:
- `tools/decision-records/tests/type-path-invariants.test.ts > decision types and paths preserve identity and alignment invariants`
- `bun test --test-name-pattern="^decision types and paths preserve identity and alignment invariants$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策 ID、生命周期类型、alignment、domain、文件路径与结构化来源 revision 必须相互对齐。
Proves:
- active 类型保证非空 alignment，archived 类型同时兼容保留值与历史 null；不匹配身份被拒绝，合法路径可稳定还原决策身份。
- 来源顺序、LF/CRLF 不改变 revision；单条正文、领域目录 metadata 和成员删除只改变契约对应的指纹或 ID 集合。
