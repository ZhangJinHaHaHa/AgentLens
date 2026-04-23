# 参与贡献 Agent 神机

首先，感谢您考虑为 Agent 神机 (Agent Shenji) 贡献力量！正是因为有您这样的人，才让这个项目变得更好。

## 从哪里开始？

如果您发现了 Bug 或有功能建议，请先查看我们的 [Issues](https://github.com/ZhangJinHaHaHa/Trusted-Agent-Marketplace/issues) 页面，确认是否已有人提交过。如果没有，请随时 [创建一个新 Issue](https://github.com/ZhangJinHaHaHa/Trusted-Agent-Marketplace/issues/new)！

## Fork 项目并创建分支

如果您打算修复某个问题，请 Fork 本仓库并创建一个具有描述性的分支名称。

一个好的分支名称示例（假设您正在处理 #325 号 Issue）：

```sh
git checkout -b 325-add-new-risk-filter
```

## 运行测试套件

请确保您已安装 Node.js 和 Docker。

```sh
# 安装依赖
cd contracts && npm install
cd ../sandbox && npm install
cd ../frontend && npm install

# 运行测试
cd contracts && npx hardhat test
cd ../sandbox && npm test
cd ../frontend && npx vitest run
```

## 实现修复或功能

现在您可以开始修改代码了。如果您是初学者，请不要犹豫，随时寻求帮助。

## 提交 Pull Request (PR)

完成修改后，请切换回您的 master 分支，并确保它是最新的：

```sh
git remote add upstream git@github.com:ZhangJinHaHaHa/Trusted-Agent-Marketplace.git
git checkout main
git pull upstream main
```

然后根据最新的 master 分支更新您的功能分支，并推送：

```sh
git checkout 325-add-new-risk-filter
git rebase main
git push --set-upstream origin 325-add-new-risk-filter
```

最后，前往 GitHub [发起 Pull Request](https://github.com/ZhangJinHaHaHa/Trusted-Agent-Marketplace/compare)，并清晰地列出您的改动内容。请确保您的每个 commit 都是原子的（一个 commit 只处理一个功能/修复）。

## 行为准则

请注意，本项目发布时附带了 [贡献者行为准则](CODE_OF_CONDUCT.md)。参与本项目即表示您同意遵守其条款。
