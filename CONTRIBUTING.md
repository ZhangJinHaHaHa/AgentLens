# Contributing to AgentLens

First off, thank you for considering contributing to AgentLens! It's people like you that make AgentLens such a great tool.

## Where do I go from here?

If you've noticed a bug or have a feature request, make sure to check our [Issues](https://github.com/ZhangJinHaHaHa/Trusted-Agent-Marketplace/issues) to see if someone else has already created a ticket. If not, go ahead and [make one](https://github.com/ZhangJinHaHaHa/Trusted-Agent-Marketplace/issues/new)!

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

# Run tests
cd contracts && npx hardhat test
cd ../sandbox && npm test
cd ../frontend && npx vitest run
```

## Implement your fix or feature

At this point, you're ready to make your changes. Feel free to ask for help; everyone is a beginner at first.

## Make a Pull Request

At this point, you should switch back to your master branch and make sure it's up to date with AgentLens's master branch:

```sh
git remote add upstream git@github.com:ZhangJinHaHaHa/Trusted-Agent-Marketplace.git
git checkout main
git pull upstream main
```

Then update your feature branch from your local copy of master, and push it!

```sh
git checkout 325-add-new-risk-filter
git rebase main
git push --set-upstream origin 325-add-new-risk-filter
```

Finally, go to GitHub and [make a Pull Request](https://github.com/ZhangJinHaHaHa/Trusted-Agent-Marketplace/compare) with a clear list of what you've done. Please make sure all of your commits are atomic (one feature per commit).

## Code of Conduct

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.
