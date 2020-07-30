# EOL Blocker

This GitHub action blocks pull requests that contain improper line-endings. GitHub and git have mechanisms to deal with keeping line-endings consistent to ensure compatibility with multiple operating systems. You can read more about this in the [GitHub help pages](https://docs.github.com/en/github/using-git/configuring-git-to-handle-line-endings), but to summarize: GitHub typically stores all text files with Unix-style line endings on their servers. The Windows versions of git clients *can* handle converting them to Windows-style on checkout, and back to Unix-style on check-in, and some repositories set this on their repo to enforce it. This mostly avoids any issues. However, there is at least one way that this "auto-conversion" can be bypassed: the "Upload files" button on GitHub.com.

If a user adds files to the repo via this button from a Windows machine, then the file on the server will contain Windows-style line endings. This can cause havoc with repositories that have multiple active contributors. As those files get synced to their local clones, the git client detects them as full-file diffs that cannot be discarded. Multiple contributors committing these changes can lead to merge conflicts that become difficult to resolve.

## The solution

To avoid these "bad" line endings from spreading to all contributors' clones, it's best to keep these from entering your default branch (or any other persistent branches that your contributors use). EOL Blocker aims to detect any pull requests that contains these type of files, and allows you to block merges until the files are fixed.

## Setup

1. Create a label in your repository named `crlf detected`. The action will flag pull requests with bad line endings with this tag. If the tag isn't present, the action will fail.

1. To install this action, create a .yml file in **.github\workflows**, with the following syntax. (See [main.yml](.github\workflows\main.yml) in this repository for an example).

    ```yml
    on:
      pull_request:
        branches:
          - main

    jobs:
      check_pull_request_job:
        runs-on: ubuntu-latest
        name: Check files for CRLF
        steps:
        - name: Validate files
          env:
            API_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          id: validate
          uses: microsoftgraph/eol-blocker@v1.0.0
    ```

1. If you wish to block merges that are flagged by this action, set the **Check files for CRLF** check as a [required status check](https://docs.github.com/en/github/administering-a-repository/about-required-status-checks).

## Code of conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
