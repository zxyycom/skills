### Case INVESTIGATION-CLI-INVESTIGATIONS-DIR-BOUNDARY-001: 调查集合目录拒绝绝对路径与父级越界

Tests:
- `test:d330ff4c896bee34d730f18f090082dab989def46ddba030792d4310b042563b`

Tags:
- `investigation-report`

Contract:
- 调查集合目录必须是工作区内相对路径。

Proves:
- 真实 IR list 对绝对 investigations-dir 与 ../ 越界目录均返回 invalid-path，未创建集合。
