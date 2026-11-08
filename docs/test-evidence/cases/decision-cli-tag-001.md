### Case DECISION-CLI-TAG-001: List 拒绝非法 tag

Tests:
- `test:a29dee226594bd95180764b87f9223fc904007c3cdbf1ee5f0946b80fc026e69`

Tags:
- `decision-records`

Contract:
- `--tag` 只接受单个 kebab-case tag。

Proves:
- 真实原生 list 对 `Bad_Tag` 退出 2、返回 invalid-arguments 且不创建领域目录。
