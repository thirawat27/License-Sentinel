# Contributing to License Sentinel

We welcome all contributions, whether it's for bug reports, feature requests, pull requests for code changes, or documentation improvements.

Please take a moment to review these guidelines to make the contribution process smooth and effective for everyone.

## 🚀 How to Contribute Code

We primarily use the GitHub Flow for development. To contribute code, please follow these steps:

1.  **Fork the Repository**: Start by forking this project to your own GitHub account.
2.  **Create a Feature Branch**: Create a new branch from `main` to begin your work. The branch name should describe what you are working on (e.g., `feature/add-new-license-support` or `fix/resolve-cache-bug`).
    ```bash
    git checkout -b feature/YourAmazingFeature
    ```
3.  **Commit Your Changes**: Develop and make changes in your branch. Once you are done, commit your changes. Try to write a clear and concise commit message.
    ```bash
    git commit -m 'feat: Add support for YourAmazingFeature'
    ```
4.  **Push to the Branch**: Push your committed code to your branch on GitHub.
    ```bash
    git push origin feature/YourAmazingFeature
    ```
5.  **Open a Pull Request**: Create a Pull Request (PR) from your branch to the `main` branch of the original project. In the PR description, please explain what you have changed or added and why this change is necessary.

## 🛠️ Setting Up Your Development Environment

1.  **Clone the Repository**: Clone the repository you forked to your local machine.
    ```bash
    git clone https://github.com/thirawat27/License-Sentinel.git
    cd License-Sentinel
    ```
2.  **Install Dependencies**: Install all project dependencies using npm.
    ```bash
    npm install
    ```
3.  **Run in VS Code**: Open the project in VS Code, then press `F5` to open a new window (Extension Development Host) with your extension running.

## ✅ Testing

This project places a high emphasis on testing. Before submitting a Pull Request, please ensure that:

* All new code you've added is covered by unit tests.
* Your changes do not break any existing tests.

You can run the tests by:
1.  Installing the [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner) from the Marketplace.
2.  Opening the Testing view from the Activity Bar and clicking the "Run Test" button.
3.  Test files are located in the `test/` folder and must end with `*.test.js`.