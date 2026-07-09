// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { jest, expect, test } from '@jest/globals';
import { Octokit } from '@octokit/core';
import { restEndpointMethods } from '@octokit/plugin-rest-endpoint-methods';
import { paginateRest } from '@octokit/plugin-paginate-rest';
import { FileContents, PullListFile } from '../src/types';

import {
  checkFileContentForCrlf,
  checkFilesForCrlf,
  generatePrComment,
  isFileExcluded,
} from '../src/validation';

const MyOctokit = Octokit.plugin(restEndpointMethods).plugin(paginateRest);

function createMockFetch(
  urlResponses: Record<string, FileContents>,
): typeof fetch {
  const mockFn = jest.fn<typeof fetch>((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const match = Object.entries(urlResponses).find(([key]) =>
      url.includes(key),
    );
    if (!match) {
      return Promise.resolve(new Response('Not Found', { status: 404 }));
    }
    return Promise.resolve(
      new Response(JSON.stringify(match[1]), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }),
    );
  });
  return mockFn as unknown as typeof fetch;
}

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
  'This file has both\nWindows-style and \r\nUnix-style line endings.\r\n';

const contentsEndpoint = 'https://api.github.com/repos/owner/repo/contents/';

function mockFile(filePath: string): PullListFile {
  return {
    sha: '',
    filename: filePath,
    status: 'added',
    additions: 0,
    deletions: 0,
    changes: 0,
    blob_url: '',
    raw_url: '',
    contents_url: `${contentsEndpoint}${filePath}`,
  };
}

function mockFileContentResponse(contents: string): FileContents {
  return {
    type: 'file',
    name: '',
    path: '',
    sha: '',
    size: 0,
    url: '',
    html_url: '',
    git_url: '',
    download_url: '',
    encoding: 'base64',
    content: Buffer.from(contents).toString('base64'),
    _links: {
      self: '',
      git: '',
      html: '',
    },
  };
}

test('File with CRLF is detected properly', async () => {
  const mockFetch = createMockFetch({
    'crlf.md': mockFileContentResponse(crlfFileContents),
  });

  const octokit = new MyOctokit({
    request: { fetch: mockFetch },
  });

  expect(
    await checkFileContentForCrlf(octokit, mockFile('crlf.md')),
  ).toBeTruthy();
});

test('File without CRLF is detected properly', async () => {
  const mockFetch = createMockFetch({
    'lf.md': mockFileContentResponse(lfFileContents),
  });

  const octokit = new MyOctokit({
    request: { fetch: mockFetch },
  });

  expect(await checkFileContentForCrlf(octokit, mockFile('lf.md'))).toBeFalsy();
});

test('File with mixed line endings is detected properly', async () => {
  const mockFetch = createMockFetch({
    'mixed.md': mockFileContentResponse(mixedFileContents),
  });

  const octokit = new MyOctokit({
    request: { fetch: mockFetch },
  });

  expect(
    await checkFileContentForCrlf(octokit, mockFile('mixed.md')),
  ).toBeTruthy();
});

const files: PullListFile[] = [
  {
    filename: 'file1.md',
    raw_url: 'https://github.com/file1.md',
    sha: '',
    status: 'added',
    additions: 0,
    deletions: 0,
    changes: 0,
    blob_url: '',
    contents_url: 'https://api.github.com/repos/owner/repo/contents/file1.md',
    patch: '',
  },
  {
    filename: 'file2.md',
    raw_url: 'https://github.com/file2.md',
    sha: '',
    status: 'added',
    additions: 0,
    deletions: 0,
    changes: 0,
    blob_url: '',
    contents_url: 'https://api.github.com/repos/owner/repo/contents/file2.md',
    patch: '',
  },
  {
    filename: 'file3.md',
    raw_url: 'https://github.com/file3.md',
    sha: '',
    status: 'added',
    additions: 0,
    deletions: 0,
    changes: 0,
    blob_url: '',
    contents_url: 'https://api.github.com/repos/owner/repo/contents/file3.md',
    patch: '',
  },
];

test('PR with CRLF files is detected properly', async () => {
  const mockFetch = createMockFetch({
    'file1.md': mockFileContentResponse(crlfFileContents),
    'file2.md': mockFileContentResponse(lfFileContents),
    'file3.md': mockFileContentResponse(mixedFileContents),
  });

  const octokit = new MyOctokit({
    request: { fetch: mockFetch },
  });

  expect(await checkFilesForCrlf(octokit, files, null)).toHaveLength(2);
});

test('Excluded files are skipped during CRLF check', async () => {
  const mockFetch = createMockFetch({
    // file1.md has CRLF but should be excluded
    'file1.md': mockFileContentResponse(crlfFileContents),
    'file2.md': mockFileContentResponse(lfFileContents),
    'file3.md': mockFileContentResponse(mixedFileContents),
  });

  const octokit = new MyOctokit({
    request: { fetch: mockFetch },
  });

  // Exclude file1.md — only file3.md (mixed) should be flagged
  const result = await checkFilesForCrlf(octokit, files, ['**/file1.md']);
  expect(result).toHaveLength(1);
  expect(result[0]).toBe('file3.md');
});

test('PR without CRLF files is detected properly', async () => {
  const mockFetch = createMockFetch({
    'file1.md': mockFileContentResponse(lfFileContents),
    'file2.md': mockFileContentResponse(lfFileContents),
    'file3.md': mockFileContentResponse(lfFileContents),
  });

  const octokit = new MyOctokit({
    request: { fetch: mockFetch },
  });

  expect(await checkFilesForCrlf(octokit, files, null)).toHaveLength(0);
});

const fileList = [
  'api-reference/beta/api/linked-resource-delete.md',
  'api-reference/beta/api/linked-resource-get.md',
  'api-reference/beta/api/linked-resource-update.md',
  'api-reference/beta/api/open-type-extension-delete.md',
  'api-reference/beta/api/open-type-extension-get.md',
  'api-reference/beta/api/open-type-extension-post-open-type-extension.md',
  'api-reference/beta/api/open-type-extension-update.md',
  'api-reference/beta/api/todo-list-lists.md',
  'api-reference/beta/api/todo-post-lists.md',
  'api-reference/beta/resources/enums.md',
  'api-reference/beta/resources/linked-resource.md',
  'api-reference/beta/resources/open-type-extension.md',
  'api-reference/beta/resources/todo-overview.md',
  'api-reference/beta/resources/todo.md',
  'api-reference/beta/resources/user.md',
  'api-reference/beta/toc.yml',
  'concepts/images/todo-api-entities.png',
  'concepts/overview-major-services.md',
  'concepts/permissions-reference.md',
  'concepts/toc.yml',
  'concepts/todo-concept-overview.md',
  '.gitignore',
  'LICENSE',
  'images/image.jpg',
  'README.md',
  'image.jpg',
  'images/image.bmp',
  'images/image.jpeg',
  'images/image.gif',
  'image.PNG',
];

test('Files are correctly excluded with default exclude list', () => {
  fileList.forEach((filename) => {
    // Case-insensitive matching: check against lowercased extension
    const lowerName = filename.toLowerCase();
    const isImage =
      lowerName.indexOf('.png') > 0 ||
      lowerName.indexOf('.jpg') > 0 ||
      lowerName.indexOf('.jpeg') > 0 ||
      lowerName.indexOf('.gif') > 0 ||
      lowerName.indexOf('.bmp') > 0;

    expect(isFileExcluded(filename, null)).toBe(isImage);
  });
});

const excludePatterns = ['**/**.png', '**/**.gif'];

test('Files are correctly excluded with custom exclude list', () => {
  fileList.forEach((filename) => {
    const lowerName = filename.toLowerCase();
    const expectedResult =
      lowerName.indexOf('.png') > 0 || lowerName.indexOf('.gif') > 0;

    expect(isFileExcluded(filename, excludePatterns)).toBe(expectedResult);
  });
});

test('Empty exclude array falls back to default exclude list', () => {
  // images should be excluded by the default list
  expect(isFileExcluded('concepts/images/todo-api-entities.png', [])).toBe(
    true,
  );
  expect(isFileExcluded('images/image.jpg', [])).toBe(true);
  // non-images should not be excluded
  expect(isFileExcluded('README.md', [])).toBe(false);
});

test('Empty file list returns no errors', async () => {
  const mockFetch = createMockFetch({});
  const octokit = new MyOctokit({
    request: { fetch: mockFetch },
  });

  expect(await checkFilesForCrlf(octokit, [], null)).toHaveLength(0);
});

test('PR comment generates correctly for a single file', () => {
  const comment = generatePrComment(['only-file.md'], 'fix-branch');
  expect(comment).toContain('- only-file.md');
  expect(comment).toContain('git rm --cached only-file.md');
  expect(comment).toContain('git add only-file.md');
  expect(comment).toContain('git checkout fix-branch');
});

test('File with bare CR (old Mac-style) is not flagged', async () => {
  const crOnlyContents = 'This file has\rold Mac-style line-endings.\r';
  const mockFetch = createMockFetch({
    'cr-only.md': mockFileContentResponse(crOnlyContents),
  });

  const octokit = new MyOctokit({
    request: { fetch: mockFetch },
  });

  expect(
    await checkFileContentForCrlf(octokit, mockFile('cr-only.md')),
  ).toBeFalsy();
});

test('Uppercase image extension is excluded by default pattern', () => {
  // The default glob patterns are lowercase; minimatch is case-sensitive
  expect(isFileExcluded('image.PNG', null)).toBe(true);
  expect(isFileExcluded('photo.JPG', null)).toBe(true);
});
