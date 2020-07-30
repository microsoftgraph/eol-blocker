import { expect, test } from '@jest/globals';
import nock from 'nock';
import { PullsListFilesResponseData } from '@octokit/types/dist-types';

import {
  checkFileContentForCrlf,
  checkFilesForCrlf,
  generatePrComment,
} from '../src/validation';

const errorFiles = ['test.md', 'subfolder/test2.md'];
const head = 'patch-1';
const expectedPrComment = `## EOL Blocker Validation Failed

The following files in this pull request have Windows-style line endings:

- test.md
- subfolder/test2.md

### How to fix

This is typically caused by uploading files directly to GitHub using the **Add file** -> **Upload files** button on GitHub.com. To fix these errors and unblock your pull request, you will need to use the [git command-line tool](https://git-scm.com/). Note that if you use [GitHub Desktop](https://desktop.github.com/), you may not have git installed. You can check by choosing the **Repository** -> **Open in Command Prompt** menu item. If you are prompted with **Unable to locate Git**, you can choose **Install Git** for instructions.

With your command-line interface (CLI) open in the root of the repository, run the following commands.

\`\`\`
git checkout patch-1
git pull origin
git rm --cached test.md subfolder/test2.md
git add test.md subfolder/test2.md
git commit -a -m "Fix line endings"
git push
\`\`\`

For assistance, please contact the admins of this repository.`;

test('PR comment generates successfully', () => {
  expect(generatePrComment(errorFiles, head)).toBe(expectedPrComment);
});

const crlfFileContents = 'This file has\r\nWindows-style line-endings.\r\n';
const lfFileContents = 'This file has\nUnix-style line-endings.\n';
const mixedFileContents =
  'This file has both\nWindows-style and \r\nUnix-style line edings.\r\n';

test('File with CRLF is detected properly', async () => {
  nock('https://github.com')
    .replyContentLength()
    .get('/crlf.md')
    .reply(200, crlfFileContents, {
      'Content-Type': 'text/plain; charset=utf-8',
    });

  expect(
    await checkFileContentForCrlf('https://github.com/crlf.md')
  ).toBeTruthy();
});

test('File without CRLF is detected properly', async () => {
  nock('https://github.com')
    .replyContentLength()
    .get('/lf.md')
    .reply(200, lfFileContents, {
      'Content-Type': 'text/plain; charset=utf-8',
    });

  expect(await checkFileContentForCrlf('https://github.com/lf.md')).toBeFalsy();
});

test('File with mixed line endings is detected properly', async () => {
  nock('https://github.com')
    .replyContentLength()
    .get('/mixed.md')
    .reply(200, mixedFileContents, {
      'Content-Type': 'text/plain; charset=utf-8',
    });

  expect(
    await checkFileContentForCrlf('https://github.com/mixed.md')
  ).toBeTruthy();
});

const files: PullsListFilesResponseData = [
  {
    filename: 'file1.md',
    raw_url: 'https://github.com/file1.md',
    sha: '',
    status: '',
    additions: 0,
    deletions: 0,
    changes: 0,
    blob_url: '',
    contents_url: '',
    patch: '',
  },
  {
    filename: 'file2.md',
    raw_url: 'https://github.com/file2.md',
    sha: '',
    status: '',
    additions: 0,
    deletions: 0,
    changes: 0,
    blob_url: '',
    contents_url: '',
    patch: '',
  },
  {
    filename: 'file3.md',
    raw_url: 'https://github.com/file3.md',
    sha: '',
    status: '',
    additions: 0,
    deletions: 0,
    changes: 0,
    blob_url: '',
    contents_url: '',
    patch: '',
  },
];

test('PR with CRLF files is detected properly', async () => {
  nock('https://github.com')
    .replyContentLength()
    .get('/file1.md')
    .reply(200, crlfFileContents, {
      'Content-Type': 'text/plain; charset=utf-8',
    })
    .get('/file2.md')
    .reply(200, lfFileContents, { 'Content-Type': 'text/plain; charset=utf-8' })
    .get('/file3.md')
    .reply(200, mixedFileContents, {
      'Content-Type': 'text/plain; charset=utf-8',
    });

  expect(await checkFilesForCrlf(files)).toHaveLength(2);
});

test('PR without CRLF files is detected properly', async () => {
  nock('https://github.com')
    .replyContentLength()
    .get('/file1.md')
    .reply(200, lfFileContents, { 'Content-Type': 'text/plain; charset=utf-8' })
    .get('/file2.md')
    .reply(200, lfFileContents, { 'Content-Type': 'text/plain; charset=utf-8' })
    .get('/file3.md')
    .reply(200, lfFileContents, {
      'Content-Type': 'text/plain; charset=utf-8',
    });

  expect(await checkFilesForCrlf(files)).toHaveLength(0);
});
