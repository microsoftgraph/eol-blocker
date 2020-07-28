export const PR_REPORT_HEADER = `## EOL Blocker Validation Failed

The following files in this pull request have Windows-style line endings:

`;

export const PR_REPORT_FOOTER = `### How to fix

This is typically caused by uploading files directly to GitHub using the **Add file** -> **Upload files** button on GitHub.com. To fix these errors and unblock your pull request, follow these steps.

#### GitHub Desktop

1. Do something...

#### git CLI

1. Do something....`;
