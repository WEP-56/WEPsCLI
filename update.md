# WEPsCLI 发布说明

本文档用于记录 `wepscli` 的发布步骤、发布注意事项，以及每次发版的更新日志。

## 发布擦坑经验 - 2026-03-23

- `wepscli` 是单独发布到 npm 的包，发布前不能只看 monorepo 本地 workspace 是否可运行，必须假设用户拿到的只有 npm 上已经发布的依赖版本。
- 这次 `v0.1.7` 的问题本质是：`wepscli` 代码引用了本地改过但尚未发布到 npm 的 `@mariozechner/pi-coding-agent` 能力，导致公网安装后新 shell 启动失败。
- 如果 `wepscli` 需要依赖 shared package 的新导出、新文件或新能力，发布前必须先确认对应 shared package 已经真正发布，不能只在本地仓库里存在。
- `npm pack --dry-run` 只能看打包内容，不能替代真实安装验证。以后每次发布前都必须执行一次 `npm pack`，然后在全新的临时目录里 `npm init -y`、`npm install <tarball>`、再真实运行 `wepscli`。
- 由于 `wepscli` 存在 fallback 到旧 workbench 的机制，发布前还必须额外用 `WEPSCLI_DISABLE_FALLBACK=1` 启动一次，确保不是“新 shell 已经挂了，但被旧界面掩盖了”。
- 如果用户反馈“界面退化”或“突然变回旧界面”，优先排查是否是 `WEPSCLI-shell` 启动失败后 fallback，而不是先假设 UI 代码本身退化。

## 当前包信息

- npm 包名: `wepscli`
- 当前已发布版本: `0.1.0`
- 全局启动命令: `wepscli`
- 包目录: `D:\WEPsCodingCLI\agents-core\packages\wepscli`

## 标准发布步骤

每次发版都按这个顺序执行，不要跳步。

1. 进入包目录

```powershell
cd D:\WEPsCodingCLI\agents-core\packages\wepscli
```

2. 确认版本号已经更新

- 位置: `package.json`
- 如果上一个版本已经发过，必须先改版本号，再发布

3. 运行发布前检查

```powershell
npx tsc -p tsconfig.build.json --noEmit
npm run build
npm pack --dry-run
```

4. 用本地 tarball 做一次真实安装验证

```powershell
npm pack
npm uninstall -g wepscli
npm install -g .\wepscli-x.y.z.tgz
wepscli --help
wepscli
```

说明:

- 这里的 `x.y.z` 替换成当前版本号
- 这一步比 `npm pack --dry-run` 更重要，因为它更接近真实用户安装环境

5. 确认 npm 登录状态和源

```powershell
npm whoami
npm config get registry
```

官方源应为:

```text
https://registry.npmjs.org/
```

如果不是官方源，切回去:

```powershell
npm config set registry https://registry.npmjs.org/
```

6. 正式发布

```powershell
npm publish
```

如果账号启用了发布 2FA，则使用:

```powershell
npm publish --otp=6位验证码
```

7. 发布后做公网安装验证

```powershell
npm uninstall -g wepscli
npm install -g wepscli
wepscli --help
wepscli
```

## 发布提醒

- 不要重复发布同一个版本号。
- 发版前必须先确认本地 `npm install -g .\wepscli-x.y.z.tgz` 能跑起来。
- 如果改动涉及 runtime、构建链、Bun 重启、依赖版本，必须做真实安装验证，不能只看 `build` 是否通过。
- 如果 npm 登录失败，优先检查 registry 是否为官方源。
- 如果 `npm publish` 提示需要 2FA，就用 `--otp=` 重新发布。
- 发布后建议执行:

```powershell
npm view wepscli version
npm view wepscli
```

## 常见问题

### 1. `npm login` 失败

大概率是因为当前 npm 源不是官方源。

```powershell
npm config set registry https://registry.npmjs.org/
npm login
```

### 2. `npm publish` 报 403，需要 2FA

使用:

```powershell
npm publish --otp=6位验证码
```

### 3. 本地能跑，安装后不能跑

优先检查:

- 是否引用了 monorepo 内部相对路径
- 是否依赖了未发布的本地包
- 是否只在 workspace 环境里才存在某些文件

### 4. 全局命令不生效

确认:

- `package.json` 里 `bin.wepscli` 是否指向 `dist/cli.js`
- `dist/cli.js` 顶部是否保留 `#!/usr/bin/env node`
- 是否用的是 `npm install -g wepscli`

## 更新日志记录规则

以后每次发版都在本文档底部追加一条，建议格式如下:

```md
## YYYY-MM-DD - vX.Y.Z

- 发布状态: 已发布 / 未发布
- 重点改动:
  - xxx
  - xxx
- 发布前验证:
  - `npx tsc -p tsconfig.build.json --noEmit`
  - `npm run build`
  - `npm pack`
  - 本地全局安装验证
- 备注:
  - xxx
```

## 更新日志

## 2026-03-22 - v0.1.0

- 发布状态: 已发布到 npm
- 重点改动:
  - 完成真实 runtime 接入、provider/model/session 持久化链路
  - 完成 tool 执行呈现、文件改动摘要、diff 预览与 approval 联动
  - 完成 `/compact`、模式层、以及一批高频 slash commands
  - 修复发布相关问题，确保包在真实全局安装环境中可启动
- 发布前验证:
  - `npx tsc -p tsconfig.build.json --noEmit`
  - `npm run build`
  - `npm pack`
  - `npm install -g .\wepscli-0.1.0.tgz`
  - `wepscli --help`
  - `wepscli`

## Release Lessons - 2026-03-23

- Do not assume local monorepo workspace success means npm users will succeed. `wepscli` must be validated against dependencies exactly as published on npm.
- If `wepscli` uses a new capability from a shared package such as `@mariozechner/pi-coding-agent`, confirm that capability is already published before releasing `wepscli`.
- `npm pack --dry-run` is not enough. Before every release, create the real tarball with `npm pack`, install it in a fresh temporary directory, and run the installed package there.
- Because `wepscli` has a fallback path to the old workbench, release verification must also be run once with `WEPSCLI_DISABLE_FALLBACK=1` so startup failures are not hidden by fallback UI.
- If users report that the UI has "regressed" or suddenly looks like the old workbench, first check whether `WEPSCLI-shell` failed to start and the app silently fell back.
- The concrete failure in `v0.1.7` was that `wepscli` referenced functionality that existed only in the local modified shared package, but not in the published npm version. That class of mistake must be treated as a release blocker.


## 2026-02-22 - v0.1.5

- 发布状态: 已发布到 npm
- 重点改动:
  - 由于超过项目约束，重构拆分shell-app.tsx ，agent-runtime.ts
  - 补充/retry等常用命令，跟进更新命令提示栏
  - 完成P8-detail / overlay / scroll 临时状态继续清理、避免 session 之间串 runtime 瞬时状态
  - 完成了P10-1 添加了skills功能以及一系列斜杠命令。通过/skills 查看弹出的命令列表以使用
- 发布前验证:
  - `npx tsc -p tsconfig.build.json --noEmit`
  - `npm run build`
  - `npm pack`
  - `npm install -g .\wepscli-0.1.0.tgz`
  - `wepscli --help`
  - `wepscli`

  ## 2026-02-23 - v0.1.8

  - 发布状态: 已发布到 npm
- 重点改动:
  - 添加了图片粘贴功能
  - 修复了错误的依赖包层级
- 发布前验证:
  - `npx tsc -p tsconfig.build.json --noEmit`
  - `npm run build`
  - `npm pack`
  - `npm install -g .\wepscli-0.1.0.tgz`
  - `wepscli --help`
  - `wepscli`
