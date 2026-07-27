# Contributing to AgentLens

First off, thank you for considering contributing to AgentLens! It's people like you that make AgentLens such a great tool.

## Where do I go from here?

If you've noticed a bug or have a feature request, check the [AgentLens issues](https://github.com/ZhangJinHaHaHa/AgentLens/issues) first. If the topic is security-sensitive, do not open a public issue; follow [SECURITY.md](SECURITY.md).

## Fork & create a branch

If this is something you think you can fix, then fork AgentLens and create a branch with a descriptive name.

A good branch name would be (where issue #325 is the ticket you're working on):

```sh
git checkout -b 325-add-new-risk-filter
```

## Get the test suite running

Make sure you have Node.js and Docker installed. 

```sh
# Install dependencies
cd contracts && npm install
cd ../sandbox && npm install
cd ../frontend && npm install

# Run tests and the production frontend build
cd contracts && npm test
cd ../sandbox && npm test
cd ../frontend && npm test && npm run build

# From the repository root, verify the public/private boundary
cd ..
node scripts/check-public-boundary.mjs
```

The public repository intentionally contains integration contracts and non-sensitive reference code, not the hosted Brain implementation, production Workers, internal quality/billing logic, credentials, server details, topology or production deployment automation. The boundary check must pass before any public push.

## Implement your fix or feature

At this point, you're ready to make your changes. Feel free to ask for help; everyone is a beginner at first.

## Make a Pull Request

At this point, you should switch back to your master branch and make sure it's up to date with AgentLens's master branch:

```sh
git remote add upstream git@github.com:ZhangJinHaHaHa/AgentLens.git
git checkout main
git pull upstream main
```

Then update your feature branch from your local copy of master, and push it!

```sh
git checkout 325-add-new-risk-filter
git rebase main
git push --set-upstream origin 325-add-new-risk-filter
```

Finally, go to GitHub and [make a Pull Request](https://github.com/ZhangJinHaHaHa/AgentLens/compare) with a clear list of what you've done. Please make sure all of your commits are atomic (one feature per commit).

## Code of Conduct

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.
