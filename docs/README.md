# Mosaic documentation

| Document                                | Read it for                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| [Architecture](architecture.md)         | The system, how an edit travels, where state lives, scaling out, security boundaries |
| [AI assistant](ai-assistant.md)         | One turn end to end, grounding, edit review, the safety layers, models and evals     |
| [Design decisions](design-decisions.md) | Why each major call was made and what it trades away                                 |
| [API](api.md)                           | Every REST route, the Socket.io events, MCP and OAuth endpoints                      |
| [Self-hosting](self-hosting.md)         | Database setup, configuration, Docker, scaling, production notes                     |
| [Development](development.md)           | Running locally, the test suites, quality checks, benchmarks                         |

Elsewhere in the repository:

- [MCP server](../mcp-server/README.md): connect Claude, Cursor, VS Code or any MCP client to a board.
- [Rendering performance](../frontend/perf/README.md): how the board was measured, with a dedicated-GPU estimate.
- [Canvas edit benchmark](../benchmark/README.md): 54 graded edit instructions and the grounding ablation.
