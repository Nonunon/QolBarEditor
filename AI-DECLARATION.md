---
version: "0.1.2"
level: auto
processes:
  design: pair
  implementation: auto
  testing: copilot
  documentation: auto
  deployment: copilot
---

This format is based on [AI-DECLARATION.md](https://ai-declaration.md/en/0.1.2/).

## Notes

- Built with Claude Opus 5.5 (Anthropic), working in Claude Code.
- Design: the idea, direction and product decisions are mine (what to build, what to drop, and the rule that everything must match the game one to one). Claude proposed designs and made most technical decisions, checking with me on the big ones.
- Implementation and documentation: Claude wrote essentially all of the code, the README, the guide and the in-app help text, taking each task through to working on its own.
- Testing: Claude wrote the automated tests (`test.mjs`) and checked changes in a browser. I tested in real use, comparing against the game with my own and friends' configs, and reported what was off.
- Deployment: Claude wrote the Cloudflare Wrangler config and the deploy script; I set up Cloudflare and GitHub and run the deploys.
- Review: there was no line-by-line human code review. Behavior was checked against QoLBar's source and in game instead.
