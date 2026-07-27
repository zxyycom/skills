### Case TEST-EVIDENCE-QUERY-REPOSITORY-001: 仓库 Topic Case 可按契约与证明检索
Entry:
- `tools/test-evidence/tests/repository-catalog.test.ts > queries the repository catalog by contract and proof terms`
- `bun test --test-name-pattern="^queries the repository catalog by contract and proof terms$" ./tools/test-evidence/tests/run.ts`
Contract:
- Test evidence 查询必须把当前仓库的受控 topic 目录投影为可检索 case metadata。
Proves:
- 跨 Contract 与 Proves 的多词查询只返回固定契约 case ID、`test-evidence` topic 与单 case 源路径。
