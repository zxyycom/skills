### Case INVESTIGATION-CLI-INVESTIGATIONS-DIR-NORMALIZATION-001: 相对调查目录在参数边界规范化

Tests:
- `test:4eddde9845e113ea7056fd624667eba7687726c4a0c22e121a47f66ec24d7d80`

Tags:
- `investigation-report`

Contract:
- 相对 `--investigations-dir` 在 CLI 参数边界规范化为工作区内相对路径后，再进入领域处理。

Proves:
- `./docs/investigations/` 输入解析为 `docs/investigations` 后才传给领域处理器。
