# 2026-07-01 - 用 Git hook 更新 package hash

## 索引摘要
- 目的: 让发布 hash 与提交内容同步，同时避免 CI 写回产生额外提交。
- 背景: GitHub Actions 在 release 成功后写回 `skill-package.hash` 会产生额外 bot 提交，干扰本地同步、提交历史阅读和 submodule 指针维护。
- 决策: 主仓库和每个子仓库都继续保留 `skill-package.hash` 源文件。

## 目的
- 让发布 hash 与提交内容同步，同时避免 CI 写回产生额外提交。

## 背景
- GitHub Actions 在 release 成功后写回 `skill-package.hash` 会产生额外 bot 提交，干扰本地同步、提交历史阅读和 submodule 指针维护。
- 但把 hash 只放在 release asset 中又会降低仓库自身的可读性，维护者无法直接从源码看到当前可打包内容的 hash。

- GitHub Actions 运行在提交之后，不能把文件修改并入已经触发 workflow 的同一个提交；它只能创建新提交、改写历史或让 check 失败。
- 本仓库仍希望保留 hash 门禁，避免没有改变可安装 skill 包时重复覆盖 latest release。
- Hash 文件应表示当前提交内的可打包 skill 内容，而不是一次外部发布任务的临时运行状态。

## 决策
- 采用: 主仓库和每个子仓库都继续保留 `skill-package.hash` 源文件。
- 采用: 通过提交前 Git hook 更新并 stage `skill-package.hash`，让 hash 和 skill 内容进入同一个提交。
- 采用: CI 校验 `skill-package.hash` 是否匹配当前提交内的 skill 打包输入；不匹配时让 workflow 失败，不再尝试自动提交修复。
- 采用: Hash 计算读取 Git `HEAD` tree/blob，而不是工作区文件字节，避免不同平台的换行转换导致本地 hook 与 CI 结果不一致。
- 采用: 发布 job 只上传 zip assets；是否发布由当前 `skill-package.hash` 与上一提交中的 `skill-package.hash` 是否不同决定，`workflow_dispatch` 保留手动重发能力。
- 采用: 主仓库提供 `bun run setup-hooks`，为主仓库和已配置 hook 的 submodule 设置 `core.hooksPath`。
- 不采用: 继续由 GitHub Actions 向 `main` 提交发布 hash；CI 不能把修改合入原提交，只会制造额外提交。
- 不采用: 只把 hash 存入 latest release asset；仓库内应直接保留当前可打包内容的 hash。

## 关系
- 修订: [使用 latest release 自动发布 skill 制品](260630-publish-skill-package-as-latest-release.md)
- 修订: [使用 skill hash 门禁 latest release 发布](260701-gate-latest-release-by-skill-hash.md)
