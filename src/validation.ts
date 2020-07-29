import * as core from '@actions/core';
import * as github from '@actions/github';
import * as Webhooks from '@octokit/webhooks';
import fetch from 'node-fetch';
import * as UserStrings from './strings';

import { PullsListFilesResponseData } from '@octokit/types/dist-types';

export async function checkFilesForCrlf(files: PullsListFilesResponseData): Promise<string[]> {
  // List of files with CRLF
  const errorFiles = [];

  for (const file of files) {
    // Get the file's raw contents. This is important as
    // we need to see the data at rest on the server, not transformed
    // by git
    const response = await fetch(file.raw_url);
    const content = await response.text();

    // Check the contents for CRLF
    if (checkFileContentForCrlf(content)) {
      // Found, add to list of "bad" files
      errorFiles.push(file.filename);
      console.log(`File: ${file.filename} - contains CRLF`);
    } else {
      console.log(`File: ${file.filename} - no CRLF`);
    }

    return errorFiles;
  }
}

export function checkFileContentForCrlf(content: string): boolean {
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
git fetch origin
git rm --cached ${errorFiles.join(' ')}
git add ${errorFiles.join(' ')}
git commit -a -m "Fix line endings"
git push
\`\`\`

${UserStrings.PR_REPORT_FOOTER}`;
}