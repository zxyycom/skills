### Case INVESTIGATION-CLI-CUSTOM-RELATIVE-DIRECTORY-001: 跨工作区使用工作区内相对调查目录

Tests:
- `test:a3f02c42e94cd967e4181afe5442c36af05d992c36e656f0576ce80975e5e978`

Tags:
- `investigation-report`

Contract:
- 跨工作区调用时显式提供 `--root`，领域目录始终使用解析后位于工作区内的相对 `--investigations-dir`。

Proves:
- 进程位于其他目录时，`--root <workspace> --investigations-dir docs/investigations` 的 `check` 成功验证目标集合。
