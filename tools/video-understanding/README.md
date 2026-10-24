# Video Understanding 工具维护

本目录维护视频证据 CLI 的 TS 源码、通用行为测试和媒体辅助／安装资源。修改产品时从下方源码与同步流程进入；使用工具时读取 [skill](../../skills/video-understanding/SKILL.md)及其[本地工具契约](../../skills/video-understanding/references/local-tools.md)。

## 源码与分发

- `src/cli-entry.ts` 以公开入口 URL 绑定 CLI 与只读资源位置。
- `src/` 保持证据协议、命令与失败语义；配置读取只消费包外用户 JSON 和显式项目 JSON。
- `resources/` 按分发相对路径保存 Python、离线策略和 `runtime/` 安装源；媒体安装仍由使用者独立授权。
- `tests/` 验证源码规则与真实 Node 分发；使用 manifest 固定的 Bun，模块 spy 的 `bun:test` 类型仅为开发依赖。
- `tests/fixtures/public-consumer.ts` 由仓库类型检查验证公开 runner、缺省参数与失败类型。

`scripts/build/video-understanding.ts` 将源码与资源同步到完整 skill 包。维护者编辑本目录的 `src/`、`resources/` 和测试，包内运行时由同步器生成；`skills/video-understanding/SKILL.md` 与 `references/` 是手工维护的分发文档。

修改后依次运行：

```text
bun run sync:video-understanding-cli
bun run check:video-understanding-cli
bun run test:video-understanding-cli
```

联合 updater 同步须得到相同完整包；依赖锁、类型与完整 Gate 按[项目工具链](../../docs/tooling.md)执行。测试按语义文件登记最小原生节点及 Case/index，组合入口保持为调度容器。

## 公开调用契约

宿主适配器从完整包的 `scripts/video.ts` 导入 `runVideoCli`、`VideoFailure` 及必要类型；内部模块与 CLI 工厂不属于稳定 SDK。

```typescript
export declare function runVideoCli(argv: string[], defaults?: {
  evidenceRoot?: string;
  appRoot?: () => Promise<string>;
}): Promise<void>;
```

`VideoFailure` 保留结构化失败；缺省值的优先级见[位置规则](../../skills/video-understanding/references/local-tools.md#位置优先级与目录)，媒体 resolver 仅在新媒体操作需要时调用。主入口使用 `process.argv.slice(2)`；普通导入不执行命令、改变退出状态或产生文件／网络副作用。

## Windows 开发与制品验收

1. 按[环境自举](../../docs/tooling.md#环境自举)准备 manifest 固定的 Node、Bun、pnpm 与仓库依赖，以及完整 Gate 的 Git、SCC 等前置。外部 Python 媒体环境与其他位置的安装副本分别准备。
2. 按上节同步并执行视频源码测试。公开入口从安装位置定位资源，源码 fixture 显式绑定 `resources/`。
3. 准备实际 `video-understanding.zip`，在 Windows 调用组合入口：

   ```powershell
   bun run accept:video-windows -- --artifact "$artifact"
   ```

   `$artifact` 是所选 zip 的绝对路径。该入口要求 Windows，先运行 `test:video-understanding-cli`，再运行 `test:video-artifact`；后者通过 `VIDEO_SKILL_ARTIFACT` 接收显式 zip。只需重跑制品测试时，在同一 PowerShell 会话执行：

   ```powershell
   $env:VIDEO_SKILL_ARTIFACT = $artifact
   bun run test:video-artifact
   ```

   保持所选制品不变，不以工作树复制或重新打包替代待验收 zip。
4. 制品测试在仓库外、无祖先 `node_modules` 的中文／空格路径解压 zip，并显式执行随包 frozen 安装；该步骤可能下载声明的 npm 依赖。Node/Bun、路径与资源、包外配置、依赖失败及恢复、离线 updater 更新和额外文件保留分别断言。updater 使用本地 release fixture，不访问真实发布；临时配置与证据不接触使用者的现有数据。

CI 的 Windows job 验收同 revision 源码和同次 Linux job 的实际 zip；本地组合入口通过不代替 Linux 全仓门禁或远端必需检查生效核对，详见[CI 与发布](../../docs/tooling.md#ci-与发布)。测试新增或调整时同步维护最小原生节点的 Case/index，不把组合入口登记为原生测试。

## 证据与支持范围

源码测试、真实 Node 启动、独立 frozen 安装和实际媒体操作分别提供证据。fixture 的证明范围限于实际断言；真实媒体、网站与 OCR 资格由[运行环境](../../skills/video-understanding/references/runtime.md)承接。包外配置与数据的复制、更新和恢复遵循[本地工具入口](../../skills/video-understanding/references/local-tools.md#复制与更新)。
