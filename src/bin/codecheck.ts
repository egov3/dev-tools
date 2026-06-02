#!/usr/bin/env node

import { runCommentsLint } from "../commands/comments-lint.js";
import { runDeadCode } from "../commands/dead-code.js";

// Module '"../commands/dead-css.js"' has no exported member 'runDeadCss'.
// import { runDeadCss } from "../commands/dead-css.js";
// Module '"../commands/dump-files.js"' has no exported member 'runDumpFiles'.
// import { runDumpFiles } from "../commands/dump-files.js";

async function main() {
	const command = process.argv[2];

	try {
		switch (command) {
			case "comments-lint": {
				const res = await runCommentsLint();
				if (res.length) {
					console.error("❌ Forbidden comments:");
					console.error(res.join("\n"));
					process.exit(1);
				}
				break;
			}

			case "dead-code":
				runDeadCode();
				break;

			// case "dump-files":
			// 	await runDumpFiles();
			// 	break;

			// case "dead-css":
			// 	await runDeadCss();
			// 	break;

			default:
				console.log(`
Usage:

  codecheck comments-lint
  codecheck dead-code
  codecheck dump-files
  codecheck dead-css
`);
				process.exit(1);
		}
	} catch (err) {
		console.error("❌ Error:", err);
		process.exit(1);
	}
}

main();
