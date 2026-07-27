### Case DECISION-EVOLVE-DUPLICATE-PREDECESSOR-001: Evolve 拒绝重复直接前序参数
Entry:
- `tools/decision-records/tests/evolution.test.ts > evolve rejects duplicate predecessor arguments without mutation`
- `bun test --test-name-pattern="^evolve rejects duplicate predecessor arguments without mutation$" ./tools/decision-records/tests/run.ts`
Contract:
- Evolve 的关系参数不得对同一直接前序重复声明不同或相同关系。
Proves:
- 重复前序参数退出 2 并返回参数诊断，候选正文与索引保持原样。
