const core = require('@actions/core');
const github = require('@actions/github');
const nodefetch = require('node-fetch');

async function run(): Promise<void> {
  console.log(`Event: ${github.context.eventName}`);
  console.log(`Owner: ${github.context.repo.owner}, repo: ${github.context.repo.repo}`);
}

run();
