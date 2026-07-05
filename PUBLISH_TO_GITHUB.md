# 发布到 GitHub

这个文件夹本身已经是一个 Git 仓库，包含从 `v0.1.0` 到 `v0.12.0` 的提交和标签。

## 方法一：用 GitHub 网页创建空仓库后推送

1. 在 GitHub 新建一个空仓库，例如：`align-sidenote-mark`。
2. 不要勾选创建 README、LICENSE 或 `.gitignore`。
3. 在终端进入本仓库目录后执行：

```bash
git remote add origin https://github.com/你的用户名/align-sidenote-mark.git
git push -u origin main
git push origin --tags
```

## 方法二：使用 GitHub CLI

```bash
gh repo create align-sidenote-mark --public --source=. --remote=origin --push
git push origin --tags
```

如果暂时不想公开，创建仓库时选择 private 即可。

