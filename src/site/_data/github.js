require('dotenv').config();

const CacheAsset = require("@11ty/eleventy-cache-assets");
const fastglob = require("fast-glob");
const graymatter = require("gray-matter");

/*
Sample return data:
{
  "data": {
    "repository": {
      "name": "repo-name",
      "stargazers": {
        "totalCount": 11
      },
      "forks": {
        "totalCount": 3
      },
      "issues": {
        "totalCount": 9
      }
    }
  }
}
*/
async function githubRequest(user, repo) {
  let errorData = {
    stars: "",
    forks: "",
    issues: "",
  };

  if(process.env.ELEVENTY_ENV == 'dev') {
    return errorData;
  }

  const query = `
  query {
    repository(owner: "${user}", name: "${repo}") {
      name
      stargazers {
        totalCount
      }
      forks {
        totalCount
      }
      issues(states:[OPEN]) {
        totalCount
      }
    }
  }
  `;

  const url = `https://api.github.com/graphql?user=${user}&repo=${repo}`;
  const fetchOptions = {
    method: "POST",
    headers: {
      "Authorization": `bearer ${process.env.GITHUB_READ_TOKEN}`
    },
    body: JSON.stringify({ query })
  };
  const opts = {
    duration: "1401m", // 23.5 hours
    type: "json",
    fetchOptions
  };

  let req;
  try {
    req = await CacheAsset(url, opts);
    if(req.errors && req.errors.length) {
      console.log( "Error", req.errors );
      return errorData;
    }

    return {
      stars: req.data.repository.stargazers.totalCount,
      forks: req.data.repository.forks.totalCount,
      issues: req.data.repository.issues.totalCount,
    }
  } catch(e) {
    console.log( "Error", e );
    return errorData;
  }
}

async function getReposFromMarkdown(glob) {
  // Starters
	let ssgs = await fastglob(glob, {
		caseSensitiveMatch: false
  });

  let repos = [];
	for(let ssg of ssgs) {
    let matter = graymatter.read(ssg);
    let fullRepo = matter.data.repo;
    if(fullRepo) {
      let split = fullRepo.split("/");
      let user = split[0];
      let repo = split[1];
      if(!matter.data.repohost || matter.data.repohost === "github")
      repos.push({ user, repo });
    } else {
      // TODO maybe just log this in production?
      // console.log( "GitHub full repo not found for", ssg );
    }
  }

  return repos;
}

module.exports = async function() {
  let data = {};

  let ssgRepos = await getReposFromMarkdown("./src/site/generators/*.md");
  for(let entry of ssgRepos) {
    data[`${entry.user}/${entry.repo}`] = await githubRequest(entry.user, entry.repo);
  }

  let cmsRepos = await getReposFromMarkdown("./src/site/headless-cms/*.md");
  for(let entry of cmsRepos) {
    data[`${entry.user}/${entry.repo}`] = await githubRequest(entry.user, entry.repo);
  }

  return data;
};