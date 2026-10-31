### Case INVESTIGATION-CLI-INVESTIGATIONS-DIR-NORMALIZATION-001: 相对调查目录在参数边界规范化

Tests:
- `test:b93193249f9c6b8ede6fcd3a3aad236684c4cc9c95f69af7cfcc21facfb16005`

Tags:
- `investigation-report`

Contract:
- 相对 `--investigations-dir` 在 CLI 参数边界规范化为工作区内相对路径后，再进入领域处理。

Proves:
- `./docs/investigations/` 输入解析为 `docs/investigations` 后才传给领域处理器。
