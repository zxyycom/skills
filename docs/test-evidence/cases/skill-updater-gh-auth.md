### Case SKILL-UPDATER-GH-AUTH-001: 复用 GitHub CLI 登录凭据完成更新

Tests:
- `test:d9734398f2e75cb07e45e183c9314f176f304aece273751273a4e270bac5d1bd`

Tags:
- `skill-updater`

Contract:
- 缺少环境凭据时，通过 gh auth token --hostname github.com 取得当前登录凭据，同次更新只解析一次并供全部 GitHub 请求使用。

Proves:
- 真实 Node 分发入口在 GH_HOST 指向其他主机且两个环境 token 均为空白时，清除子进程环境中的空白 token 覆盖并请求 github.com 凭据一次。
- 指定 tag 的 release、manifest 和 zip 请求均携带去除首尾空白后的同一凭据，目标 SKILL.md 为远端正文，退出 0 且 stdout/stderr 不包含凭据。
