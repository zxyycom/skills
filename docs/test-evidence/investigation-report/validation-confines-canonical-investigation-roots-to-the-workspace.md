### Case INVESTIGATION-ROOT-CONFINEMENT-001: 调查根目录的真实路径受工作区边界约束

Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > validation confines canonical investigation roots to the workspace`
- `bun test --test-name-pattern="^validation confines canonical investigation roots to the workspace$" ./tools/investigation-report/tests/run.ts`

Contract:
- 调查根目录可以通过符号链接定位，但其规范化真实路径必须仍位于工作区内；校验与索引同步都不能沿根目录链接越出工作区。

Proves:
- 指向工作区外调查集合的根目录符号链接会让校验与索引同步返回工作区边界诊断。
- 指向同一工作区内调查集合的根目录符号链接可以通过校验。
