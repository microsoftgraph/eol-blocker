import * as core from '@actions/core';
import * as github from '@actions/github';
import * as Webhooks from '@octokit/webhooks';

import { checkFilesForCrlf, generatePrComment } from './validation';

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
      const errorFiles = await checkFilesForCrlf(files);
      console.log(`File check complete. ${errorFiles.length} files with CRLF.`);
      // If there are files with CRLF, build the comment
      if (errorFiles.length > 0) {
        const prComment = generatePrComment(
          errorFiles,
          pullPayload.pull_request.head.ref
        );

        try {
          // Post the comment in the pull request
          await octokit.issues.createComment({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: pullPayload.pull_request.number,
            body: prComment,
          });
        } catch (createCommentError)
        {
          console.log(`Unable to create comment\n${JSON.stringify(createCommentError)}`);
        }

        try {
          // Add the crlf detected label
          await octokit.issues.addLabels({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: pullPayload.pull_request.number,
            labels: ['crlf detected'],
          });
        } catch (addLabelError) {
          console.log(`Unable to add label\n${JSON.stringify(addLabelError)}`);
        }

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
        } catch (removeLabelError) {
          // If label wasn't there, this returns an error
          if (removeLabelError.message !== 'Label does not exist') {
            console.log(`Unable to remove label\n${JSON.stringify(removeLabelError)}`);
            //.setFailed(
            //  `Unexpected label error: \n${JSON.stringify(removeLabelError)}`
            //);
          }
        }
      }
    }
  } catch (error) {
    // General error
    core.setFailed(`Unexpected error: \n${JSON.stringify(error)}`);
  }
}

run();
