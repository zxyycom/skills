### Case CHANGE-PLAN-FINALIZE-007: Finalize Tombstone 声明不覆盖并发目标

Tests:
- `test:876cfd5aec5157554b034a0735b6f7fe56b1b329888aceb7077c667f6dffcde6`

Tags:
- `change-plan`

Contract:
- tombstone target 必须先以独占目录声明；POSIX `rename()` 不能作为 no-overwrite 目录移动原语。声明竞争或复制中发现外来成员时，source 不删除，也不删除外来 target。

Proves:
- hook 在 target 声明后写入外来文件时，操作返回 `no-change` 与精确 target 路径。
- source 保持，外来文件字节保持，不发生覆盖或递归清理。
