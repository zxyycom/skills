### Case INVESTIGATION-CLI-CUSTOM-RELATIVE-DIRECTORY-001: 跨工作区使用工作区内相对调查目录

Tests:
- `test:550fca6010283f444baa42f76b3ef72856452c4f7dc719f2ed8bc2959dcc6cf2`

Tags:
- `investigation-report`

Contract:
- 跨工作区调用时显式提供 `--root`，领域目录始终使用解析后位于工作区内的相对 `--investigations-dir`。

Proves:
- 进程位于其他目录时，`--root <workspace> --investigations-dir docs/investigations` 的 `check` 成功验证目标集合。
