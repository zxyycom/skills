---
title: "Git 输入错误可能先于子进程退出释放暂存锁"
id: "261028-git-stdin-error-lock-lifecycle"
formedAt: "2026-10-28T06:03:15Z"
question: "Git 写对象输入失败时，何时才能安全释放 pending 锁？"
tags:
  - "concurrency"
  - "git-integration"
  - "root-cause-analysis"
  - "version-control"
relations: []
---

## 形成时背景

2026-10-28 在 `eea1d03e` 基线上改进同次 pending 对象写入时，发现共享 Git 命令的 stdin 错误分支在发送终止信号后立即拒绝；调用方随即可能恢复并释放 index 锁。原问题涉及并发时序与跨进程锁，不能仅凭信号发送推断子进程退出。

## 调查目的

确认 stdin 错误、子进程实际结束与 pending 锁恢复的先后责任，并验证修复后的启动失败、终止失败及并发写入收束边界。

## 调查范围与依据

- 环境：Linux、Node.js v26.8.2、Git 2.53.0；源码基线为 `eea1d03e`。检查 `tools/shared/src/version-control/git-command.ts`、`git-pending.ts` 和 `git-pending-replacement.ts`。
- 隔离时序实验以模拟 Git 的 Node 子进程关闭 stdin 并忽略 TERM，向原版和修复版分别输入 8 MiB；原版 Promise 拒绝时子进程仍存活，修复版拒绝时子进程已结束。实验模拟输入管道错误，不证明真实 Git 常态下会出现此错误。
- `tools/shared/tests/version-control-blob-write-failure.test.ts` 通过真实临时 Git 仓库和受控 wrapper 覆盖实际替换：输入错误、TERM 忽略、信号抛错或发出 EPERM、启动失败、并发写入失败及锁与 index 状态。随附探针在仓库根运行并核对基线与修改源码指纹，记录当时结果；源码改变时先恢复指定字节再复验。

## 调查结果与边界

- 原实现将 `stdin` 错误处理为 `kill()` 后立即 reject；`kill()` 只发送信号，不能证明子进程已退出。pending 锁恢复等待的是 Promise，而不是实际子进程，因此旧时序允许锁先释放。实验观察的是进程仍存活；锁外实际对象写入是可能的风险，未观察到真实数据损坏。
- Node 的进程错误回调也可能先于 `close`，不能仅将拒绝延后到该回调。修复将回调结果与 `close` 同时作为结算前提；stdin 出错后先请求终止，必要时升级强制终止，已启动的并发对象写入全部结算后才交回锁恢复。首次观察到的失败停止新派发；已写入但未引用的 Git 对象不承诺回滚。
- 定向测试验证进程在锁保持期间终止、失败不发布 pending，启动失败可恢复锁；独立真实 Git 模式和混合内容验证见 `tools/shared/tests/version-control-blob-write.test.ts`。现有 CAS、未选保护及写后验收仍由替换事务负责。
- 若操作系统持续拒绝终止且子进程永不退出，等待会持续以避免释放锁后仍有写入；这不是恢复成功。Windows、异常文件系统和真实 Git 触发 stdin 错误的频率未验证。恢复应先确认子进程和锁状态，不能仅因等待超时删除锁。

## 随附资源

- [环境、源码指纹与时序观察](./_resources/261028-git-stdin-error-lock-lifecycle/probe-results.json)
- [输入错误时序的隔离探针](./_resources/261028-git-stdin-error-lock-lifecycle/probe.mjs)
