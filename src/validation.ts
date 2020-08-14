import * as core from '@actions/core';
import fetch from 'node-fetch';
import * as UserStrings from './strings';
import minimatch = require('minimatch');

import { PullsListFilesResponseData } from '@octokit/types/dist-types';

export async function checkFilesForCrlf(
  files: PullsListFilesResponseData,
  excludedFiles: string[] | null
): Promise<string[]> {
  // List of files with CRLF
  const errorFiles = [];

  for (const file of files) {
    // Check the contents for CRLF
    if (!isFileExcluded(file.filename, excludedFiles)) {
      if (await checkFileContentForCrlf(file.raw_url)) {
        // Found, add to list of "bad" files
        errorFiles.push(file.filename);
        core.warning(`File: ${file.filename} - contains CRLF`);
      } else {
        core.info(`File: ${file.filename} - no CRLF`);
      }
    }
  }

  return errorFiles;
}

export async function checkFileContentForCrlf(
  fileUrl: string
): Promise<boolean> {
  // Get the file's raw contents. This is important as
  // we need to see the data at rest on the server, not transformed
  // by git
  const response = await fetch(fileUrl);
  const content = await response.text();

  return /\r\n/g.test(content);
}

export function generatePrComment(errorFiles: string[], head: string): string {
  let fileList = '';

  // Create a bulleted list of the files
  errorFiles.forEach((file) => {
    fileList = fileList + `- ${file}\n`;
  });

  return `${UserStrings.PR_REPORT_HEADER}
${fileList}
${UserStrings.PR_REPORT_FIX_INTRO}
\`\`\`
git checkout ${head}
git pull origin
git rm --cached ${errorFiles.join(' ')}
git add ${errorFiles.join(' ')}
git commit -a -m "Fix line endings"
git push
\`\`\`

${UserStrings.PR_REPORT_FOOTER}`;
}

const defaultExcludeList: string[] = ['**/**.{png,jpg,jpeg,gif,bmp}'];

export function isFileExcluded(
  filePath: string,
  excludedFilePatterns: string[] | null
): boolean {
  if (excludedFilePatterns === null || excludedFilePatterns.length <= 0) {
    excludedFilePatterns = defaultExcludeList;
  }

  for (const globPattern of excludedFilePatterns) {
    if (minimatch(filePath, globPattern)) {
      return true;
    }
  }

  return false;
}
