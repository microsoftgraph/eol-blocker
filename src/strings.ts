export const PR_REPORT_HEADER = `## EOL Blocker Validation Failed

The following files in this pull request have Windows-style line endings:
`;

export const PR_REPORT_FIX_INTRO = `### How to fix

This is typically caused by uploading files directly to GitHub using the **Add file** -> **Upload files** button on GitHub.com. To fix these errors and unblock your pull request, you will need to use the [git command-line tool](https://git-scm.com/). Note that if you use [GitHub Desktop](https://desktop.github.com/), you may not have git installed. You can check by choosing the **Repository** -> **Open in Command Prompt** menu item. If you are prompted with **Unable to locate Git**, you can choose **Install Git** for instructions.

With your command-line interface (CLI) open in the root of the repository, run the following commands.
`;

export const PR_REPORT_FOOTER = `For assistance, please contact the admins of this repository.`;
