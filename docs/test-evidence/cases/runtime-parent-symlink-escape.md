### Case RUNTIME-PARENT-SYMLINK-ESCAPE-001: 源码父目录链接逃逸在扫描或读取外部字节前拒绝

Tests:
- `test:103f01f8aa3e1633a8a0bba646ee7aed610cab46d8107f73c5c932c01c2e6fd7`

Tags:
- `repository-tooling`

Contract:
- runtime 源码必须仍位于工作区可信 tools 根；普通文件身份不允许通过祖先 symlink 逃出可信边界。
- 捕获源码事实及根据事实复制文件时都重新验证边界；不承诺抵御恶意并发替换的 sandbox。

Proves:
- 隔离真实文件树中 alpha 经过 tools/linked 父目录链接指向工作区外普通 TypeScript 文件，capture 明确报告逃出可信 tools，未返回生成物，也未创建 skills 输出。
- 健康闭包先捕获 facts 后确定性替换父目录为外链，build 在再次读取前同样拒绝，不能凭旧 facts 复制外部字节。
- 子进程仅监视 Node readFile 与实际 ast-grep 扫描目标，健康输入仍调用真实实现；两个场景均无外部读取或扫描请求，外部文件字节保持不变。
