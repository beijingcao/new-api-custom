# new-api 自定义支付宝版本升级操作手册

本文档用于以后手动升级自定义版 `new-api`。

目标是把官方仓库 `QuantumNous/new-api` 的最新版本合并到你的自定义分支 `local/alipay`，同时保留支付宝充值功能和前端自定义，然后推送到你的 GitHub 仓库 `beijingcao/new-api-custom`，用于 1Panel 继续部署：

```yaml
image: ghcr.io/beijingcao/new-api-custom:alipay
```

## 1. 进入项目目录

```bash
cd /Users/adam/sync-root/Macbook/new-api
```

确认当前分支：

```bash
git status --short --branch
```

正常应看到类似：

```bash
## local/alipay...myfork/local/alipay
```

如果当前不在 `local/alipay`：

```bash
git switch local/alipay
```

## 2. 确认工作区干净

```bash
git status
```

理想结果：

```bash
On branch local/alipay
Your branch is up to date with 'myfork/local/alipay'.

nothing to commit, working tree clean
```

如果看到有未提交修改，不要直接升级。先临时保存：

```bash
git stash push -m "before-new-api-upgrade"
```

然后再次确认：

```bash
git status
```

必须干净后再继续。

## 3. 拉取官方最新代码和 tag

```bash
git fetch origin --tags
git fetch myfork
```

查看官方最新 tag：

```bash
git for-each-ref --sort=-creatordate --format='%(refname:short) %(creatordate:short) %(objectname:short)' refs/tags | head -20
```

输出示例：

```bash
v1.0.0-rc.6 2026-05-13 613de444
v1.0.0-rc.5 2026-05-12 fe92552f
v1.0.0-rc.4 2026-05-06 4f3272fe
```

最上面的通常就是当前最新版本。

## 4. 判断是否需要升级

查看官方主分支：

```bash
git log --oneline --decorate -5 origin/main
```

假设最新 tag 是 `v1.0.0-rc.7`，先取 tag 对应的真实 commit：

```bash
git rev-list -n 1 v1.0.0-rc.7
```

假设输出：

```bash
abcdef1234567890
```

检查当前分支是否已经包含它：

```bash
git merge-base --is-ancestor abcdef1234567890 HEAD && echo "已包含官方最新版本"
```

如果输出：

```bash
已包含官方最新版本
```

说明当前分支已经是官方最新版本加你的自定义代码，不需要再次合并。可以直接跳到“验证”和“部署”。

## 5. 合并官方最新版本

不要直接执行：

```bash
git merge v1.0.0-rc.7
```

原因：直接 merge tag 可能触发 GPG 验签问题。正确做法是合并 tag 指向的真实 commit。

先取 commit：

```bash
git rev-list -n 1 v1.0.0-rc.7
```

再合并：

```bash
git merge abcdef1234567890
```

把 `abcdef1234567890` 换成上一步实际输出的 commit。

## 6. 处理冲突

如果合并时出现冲突，先查看冲突文件：

```bash
git status
```

重点关注这些区域：

```text
controller/topup.go
controller/topup_alipay.go
setting/payment_alipay.go
model/topup.go
router/api-router.go
web/default/src/features/system-settings/...
web/default/src/features/wallet/...
web/classic/src/components/topup/...
web/classic/src/components/settings/PaymentSetting.jsx
web/*/src/i18n/locales/...
```

处理原则：

```text
官方新版结构要保留。
你的支付宝逻辑要补回去。
不要整块无脑选择 Accept Current 或 Accept Incoming。
```

冲突解决完成后，检查是否还有冲突标记：

```bash
rg -n '^(<<<<<<<|=======|>>>>>>>)' controller web/default/src web/classic/src router model setting common service -g '!web/default/dist/**' -g '!web/classic/dist/**'
```

没有输出表示冲突标记已清理。

再检查空白和格式问题：

```bash
git diff --check
```

没有输出表示通过。

标记冲突已解决：

```bash
git add .
```

提交合并：

```bash
git commit -m "merge upstream v1.0.0-rc.7 with alipay customizations"
```

把 `v1.0.0-rc.7` 换成实际升级的版本号。

## 7. 验证新版前端

验证 `web/default`：

```bash
cd /Users/adam/sync-root/Macbook/new-api/web/default
npm run typecheck
npm run build
```

验证 `web/classic`：

```bash
cd /Users/adam/sync-root/Macbook/new-api/web/classic
npm run build
```

如果你的电脑安装了 `bun`，也可以按项目官方方式：

```bash
bun install
bun run build
```

如果 classic 构建提示 peer dependency 或依赖解析问题，可以先运行：

```bash
npm install --package-lock=false --legacy-peer-deps --cache /private/tmp/new-api-npm-cache-classic
npm run build
```

## 8. 验证后端

如果本机安装了 Go：

```bash
cd /Users/adam/sync-root/Macbook/new-api
go test ./controller ./model
```

如果提示：

```bash
go: command not found
```

说明本机没有 Go 工具链，可以跳过本地 Go 测试，但最终要以 GitHub Actions 和 Docker 镜像构建是否成功为准。

## 9. 确认本地状态

```bash
cd /Users/adam/sync-root/Macbook/new-api
git status --short --branch
```

如果刚刚有合并提交，可能看到：

```bash
## local/alipay...myfork/local/alipay [ahead 1]
```

这表示本地比 GitHub 多一个提交，需要推送。

## 10. 推送到你的 GitHub 仓库

```bash
git push myfork local/alipay
```

成功后会看到类似：

```bash
local/alipay -> local/alipay
```

如果显示：

```bash
Everything up-to-date
```

说明没有新提交需要推送。

## 11. 检查 GitHub Actions

打开：

```text
https://github.com/beijingcao/new-api-custom/actions
```

找到工作流：

```text
Build Custom Alipay Image
```

确认它成功。

该工作流会构建并推送镜像：

```text
ghcr.io/beijingcao/new-api-custom:alipay
ghcr.io/beijingcao/new-api-custom:alipay-提交SHA
```

如果本次没有新提交，`git push` 显示 `Everything up-to-date`，GitHub Actions 不会重新触发，这是正常的。

## 12. 在 1Panel 更新部署

等 GitHub Actions 成功后，进入 1Panel，对你的应用执行：

1. 拉取最新镜像。
2. 重建容器。
3. 查看容器日志。
4. 打开网站后台确认能登录。
5. 确认支付宝配置页还在。
6. 确认充值页面能看到支付宝。
7. 小金额测试支付回调是否入账。

compose 中继续使用：

```yaml
services:
  my-api:
    image: ghcr.io/beijingcao/new-api-custom:alipay
```

## 13. 升级前必须注意

升级前先备份数据库，尤其是跨版本升级时。

如果新旧容器共用数据库，不要同时长时间运行两个版本处理生产流量。可以保留旧容器备用，但实际访问入口只指向一个版本。

## 常见问题

### git merge tag 报 GPG 错误

如果执行：

```bash
git merge v1.0.0-rc.7
```

报错：

```text
error: cannot run gpg
```

改用：

```bash
git rev-list -n 1 v1.0.0-rc.7
git merge 上一步输出的commit
```

### 有未提交文件时怎么办

先临时保存：

```bash
git stash push -m "before-new-api-upgrade"
```

升级完成后查看：

```bash
git stash list
```

不要随便执行 `git stash pop`，因为可能会把旧的页脚、版权、配置改动重新带回来。

### GitHub Actions 没自动运行

先确认工作流文件存在：

```bash
cat .github/workflows/docker-build-custom.yml
```

它应该包含：

```yaml
on:
  push:
    branches:
      - local/alipay
```

如果本次没有新提交，Actions 不运行是正常的。

## 快速命令版

把 `v最新版本号` 替换为实际最新 tag，例如 `v1.0.0-rc.7`。

```bash
cd /Users/adam/sync-root/Macbook/new-api
git switch local/alipay
git status

git fetch origin --tags
git fetch myfork

git for-each-ref --sort=-creatordate --format='%(refname:short) %(creatordate:short) %(objectname:short)' refs/tags | head -20

git rev-list -n 1 v最新版本号
git merge 上一步输出的commit

rg -n '^(<<<<<<<|=======|>>>>>>>)' controller web/default/src web/classic/src router model setting common service -g '!web/default/dist/**' -g '!web/classic/dist/**'
git diff --check

cd web/default
npm run typecheck
npm run build

cd ../classic
npm run build

cd /Users/adam/sync-root/Macbook/new-api
git status
git push myfork local/alipay
```

