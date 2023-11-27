import { expect, test } from '@jest/globals';
import fetchMock from 'fetch-mock';
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
  const mock = fetchMock.sandbox().getOnce(contentsEndpoint + 'crlf.md', {
    body: mockFileContentResponse(crlfFileContents),
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });

  const octokit = new MyOctokit({
    request: {
      fetch: mock,
    },
  });

  expect(
    await checkFileContentForCrlf(octokit, mockFile('crlf.md')),
  ).toBeTruthy();
});

test('File without CRLF is detected properly', async () => {
  const mock = fetchMock.sandbox().getOnce(contentsEndpoint + 'lf.md', {
    body: mockFileContentResponse(lfFileContents),
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });

  const octokit = new MyOctokit({
    request: {
      fetch: mock,
    },
  });

  expect(await checkFileContentForCrlf(octokit, mockFile('lf.md'))).toBeFalsy();
});

test('File with mixed line endings is detected properly', async () => {
  const mock = fetchMock.sandbox().getOnce(contentsEndpoint + 'mixed.md', {
    body: mockFileContentResponse(mixedFileContents),
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });

  const octokit = new MyOctokit({
    request: {
      fetch: mock,
    },
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
  const mock = fetchMock
    .sandbox()
    .getOnce(contentsEndpoint + 'file1.md', {
      body: mockFileContentResponse(crlfFileContents),
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    })
    .getOnce(contentsEndpoint + 'file2.md', {
      body: mockFileContentResponse(lfFileContents),
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    })
    .getOnce(contentsEndpoint + 'file3.md', {
      body: mockFileContentResponse(mixedFileContents),
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });

  const octokit = new MyOctokit({
    request: {
      fetch: mock,
    },
  });

  expect(await checkFilesForCrlf(octokit, files, null)).toHaveLength(2);
});

test('PR without CRLF files is detected properly', async () => {
  const mock = fetchMock
    .sandbox()
    .getOnce(contentsEndpoint + 'file1.md', {
      body: mockFileContentResponse(lfFileContents),
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    })
    .getOnce(contentsEndpoint + 'file2.md', {
      body: mockFileContentResponse(lfFileContents),
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    })
    .getOnce(contentsEndpoint + 'file3.md', {
      body: mockFileContentResponse(lfFileContents),
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });

  const octokit = new MyOctokit({
    request: {
      fetch: mock,
    },
  });

  expect(await checkFilesForCrlf(octokit, files, null)).toHaveLength(0);
});

const fileList = [
  'api-reference/beta/api/linkedresource-delete.md',
  'api-reference/beta/api/linkedresource-get.md',
  'api-reference/beta/api/linkedresource-update.md',
  'api-reference/beta/api/opentypeextension-delete.md',
  'api-reference/beta/api/opentypeextension-get.md',
  'api-reference/beta/api/opentypeextension-post-opentypeextension.md',
  'api-reference/beta/api/opentypeextension-update.md',
  'api-reference/beta/api/todo-list-lists.md',
  'api-reference/beta/api/todo-post-lists.md',
  'api-reference/beta/resources/enums.md',
  'api-reference/beta/resources/linkedresource.md',
  'api-reference/beta/resources/opentypeextension.md',
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
    // Is this an image?
    const isImage =
      filename.indexOf('.png') > 0 ||
      filename.indexOf('.jpg') > 0 ||
      filename.indexOf('.jpeg') > 0 ||
      filename.indexOf('.gif') > 0 ||
      filename.indexOf('.bmp') > 0;

    expect(isFileExcluded(filename, null)).toBe(isImage);
  });
});

const excludePatterns = ['**/**.png', '**/**.gif'];

test('Files are correctly excluded with custom exclude list', () => {
  fileList.forEach((filename) => {
    const expectedResult =
      filename.indexOf('.png') > 0 || filename.indexOf('.gif') > 0;

    expect(isFileExcluded(filename, excludePatterns)).toBe(expectedResult);
  });
});
