import * as core from '@actions/core';
import * as github from '@actions/github';
import * as UserStrings from './strings';

async function run(): Promise<void> {
  try {
    // Should only execute for pull requests
    if (github.context.eventName === 'pull_request') {
      const pullPayload = github.context.payload;

      const octokit = github.getOctokit(process.env.API_TOKEN!);

      // Get all files in the pull request
      const files = await octokit.pulls.listFiles({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        pull_number: pullPayload.pull_request?.number!,
        per_page: 2
      });

      // Pattern to report: CRLF
      const regex = /\r\n/g;

      // List of files with CRLF
      var errorFiles = [];

      for (const file of files.data) {
        console.log(`File: ${file.filename}`);

        // Get the file's raw contents. This is important as
        // we need to see the data at rest on the server, not transformed
        // by git
        const response = await fetch(file.raw_url);
        const content = await response.text();

        // Check the contents for CRLF
        if (regex.test(content)) {
          // Found, add to list of "bad" files
          errorFiles.push(file);
          console.log('File contains CRLF');
        } else {
          console.log('File is clean');
        }
      }

      // Initialize comment
      var prComment = UserStrings.PR_REPORT_HEADER;

      // If there are files with CRLF, build the comment
      if (errorFiles.length > 0) {

        // Create a bullted list of the files
        errorFiles.forEach(file => {
          prComment = prComment + `- ${file.filename}\n`;
        });

        // Add the footer (instructions to fix)
        prComment = prComment + UserStrings.PR_REPORT_FOOTER;

        // Post the comment in the pull request
        octokit.issues.createComment({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          issue_number: pullPayload.pull_request?.number!,
          body: prComment
        });

        // Add the crlf detected label
        octokit.issues.addLabels({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          issue_number: pullPayload.pull_request?.number!,
          labels: [ 'crlf detected' ]
        });

        // Indicate failure to block the pull request
        core.setFailed('Files with CRLF detected in pull request');
      } else {
        // No CRLF detected, remove the crlf detected label if present
        octokit.issues.removeLabel({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          issue_number: pullPayload.pull_request?.number!,
          name: 'crlf detected'
        });
      }
    }
  } catch (error) {
    // General error
    core.setFailed(`Unexpected error: \n${error.message}\n\nSee action logs for more information.`);
  }
}

run();