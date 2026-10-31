### Case SKILL-PACKAGE-INSTALLATION-FILTER-001: 强制暂存的安装状态不能进入 skill 制品

Tests:
- `test:964f30627ffc5b473c5eabc3641d0d8f1496e2cb5a66dbb43ed7499a9c6e375d`

Tags:
- `repository-tooling`

Contract:
- Skill 制品在捕获 pending 快照时排除任意层依赖目录、包管理器 store、缓存与其安装链接；hash、zip 和版本基线使用相同正式内容集合。

Proves:
- 真实 Git 强制暂存安装文件和链接后，两种收集入口的正式文件、hash 与 zip 均保持不变；删除旧版已提交的安装文件不要求提升版本。
