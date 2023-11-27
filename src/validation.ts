import * as core from '@actions/core';
import { GitHub } from '@actions/github/lib/utils';
import * as UserStrings from './strings';
import minimatch = require('minimatch');
import { FileContents, PullListFile } from './types';

export async function checkFilesForCrlf(
  octokit: InstanceType<typeof GitHub>,
  files: PullListFile[],
  excludedFiles: string[] | null,
): Promise<string[]> {
  // List of files with CRLF
  const errorFiles = [];

  for (const file of files) {
    // Check the contents for CRLF
    if (isFileExcluded(file.filename, excludedFiles)) {
      core.info(`File: ${file.filename} is excluded`);
    } else {
      if (await checkFileContentForCrlf(octokit, file)) {
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
  octokit: InstanceType<typeof GitHub>,
  file: PullListFile,
): Promise<boolean> {
  // Get the file's raw contents. This is important as
  // we need to see the data at rest on the server, not transformed
  // by git
  const response = await octokit.request(file.contents_url);
  const fileContents = response.data as FileContents;
  const content = Buffer.from(fileContents.content, 'base64').toString('utf-8');

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
  excludedFilePatterns: string[] | null,
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
