### Case NATIVE-SKILL-GIT-IGNORE-001: 原生 skill 忽略本机安装产物并保留分发源码

Tests:
- `test:26929cd430d901fcdcf5f62f799e32d237c6fe902de4f25e88e9331e50e15147`

Tags:
- `native-delivery`
- `tooling`

Contract:
- 三个原生记录 skill 的随包 `.gitignore` 对 skill 根内的平台程序补充忽略规则；分发源码与其他目录的可执行文件保持可见。

Proves:
- 将仓库生成的 `.gitignore` 放入隔离 Git 仓库的嵌套 skill 目录后，真实 `git check-ignore` 排除 Linux/Windows 程序文件名及 Node 依赖路径。
- 同一查询保留包外文件、skill 文档、描述符、manifest、锁文件、更新入口、运行时源码、Schema，以及其他目录的 `bin/` 与 `.exe` 路径。
