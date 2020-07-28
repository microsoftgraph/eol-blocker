import * as core from '@actions/core';
import * as github from '@actions/github';
import * as Webhooks from '@octokit/webhooks';
import fetch from 'node-fetch';
import * as UserStrings from './strings';

async function run(): Promise<void> {
  try {
    // Should only execute for pull requests
    if (github.context.eventName === 'pull_request') {
      const pullPayload = github.context
        .payload as Webhooks.Webhooks.WebhookPayloadPullRequest;

      if (process.env.API_TOKEN === undefined) {
        core.setFailed('No app token available.');
        return;
      }

      const octokit = github.getOctokit(process.env.API_TOKEN);

      // Get all files in the pull request
      const files = await octokit.paginate(
        'GET /repos/:owner/:repo/pulls/:pull_number/files',
        {
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          pull_number: pullPayload.pull_request.number,
        }
      );

      // List of files with CRLF
      const errorFiles = [];

      for (const file of files) {
        // Get the file's raw contents. This is important as
        // we need to see the data at rest on the server, not transformed
        // by git
        const response = await fetch(file.raw_url);
        const content = await response.text();

        // Check the contents for CRLF
        if (/\r\n/g.test(content)) {
          // Found, add to list of "bad" files
          errorFiles.push(file.filename);
          console.log(`File: ${file.filename} - contains CRLF`);
        } else {
          console.log(`File: ${file.filename} - no CRLF`);
        }
      }

      // If there are files with CRLF, build the comment
      if (errorFiles.length > 0) {
        let fileList = '';

        // Create a bulleted list of the files
        errorFiles.forEach((file) => {
          fileList = fileList + `- ${file}\n`;
        });

        const prComment = `${UserStrings.PR_REPORT_HEADER}

${fileList}

${UserStrings.PR_REPORT_FIX_INTRO}

\`\`\`
git checkout ${pullPayload.pull_request.head.ref}
git fetch origin
git rm --cached ${errorFiles.join(' ')}
git add ${errorFiles.join(' ')}
git commit -a -m "Fix line endings"
git push
\`\`\`

${UserStrings.PR_REPORT_FOOTER}`;

        // Post the comment in the pull request
        await octokit.issues.createComment({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          issue_number: pullPayload.pull_request.number,
          body: prComment,
        });

        // Add the crlf detected label
        await octokit.issues.addLabels({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          issue_number: pullPayload.pull_request.number,
          labels: ['crlf detected'],
        });

        // Indicate failure to block the pull request
        core.setFailed('Files with CRLF detected in pull request');
      } else {
        // No CRLF detected, remove the crlf detected label if present
        try {
          await octokit.issues.removeLabel({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: pullPayload.pull_request.number,
            name: 'crlf detected',
          });
        } catch (labelError) {
          // If label wasn't there, this returns an error
          if (labelError.message !== 'Label does not exist') {
            core.setFailed(`Unexpected error: \n${labelError.message}`);
          }
        }
      }
    }
  } catch (error) {
    // General error
    core.setFailed(`Unexpected error: \n${error.message}`);
  }
}

run();
