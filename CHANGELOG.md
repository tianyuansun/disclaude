# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2026-02-28

### Highlights

**Code Quality & Architecture Improvements** - Major refactoring efforts to improve code maintainability, eliminate dead code, and enhance test coverage.

### Added

- **SDK Abstraction Layer** - Agent SDK abstraction for better modularity (#247, #279, #291, #292)
- **Secure OAuth Authentication** - Third-party OAuth authentication system (#249)
- **PrimaryNode & WorkerNode** - Unified architecture for execution nodes (#248)
- **Card Interaction Support** - Feishu card message interaction handling (#275)
- **Message Level Routing** - Message routing system for better organization (#266)
- **Reflection Pattern Interface** - Iteration observability and control (#271)
- **Schedule Recommend Skill** - Intelligent task recommendations (#265)
- **PM2 Ecosystem Config** - Example configuration for primary node (#271)
- **RestartManager** - Backoff and circuit breaker for agent restarts (#313)

### Changed

- **Channel Architecture Refactoring** - Decoupled platform-specific implementations (#163)
- **File Transfer System Unification** - Eliminated redundant modules (#194, #235, #267)
- **Platform Module Organization** - Moved Feishu module to platforms/feishu (#276)
- **Bot Mention Command Pass-through** - Commands passed to agent when bot is mentioned (#280)

### Fixed

- **SDK Subprocess PATH** - Ensure PATH is always set for SDK subprocess (#313)
- **Nested SDK Sessions** - Unset CLAUDECODE to allow nested sessions (#313)
- **Test Import Paths** - Corrected import paths in test files (#289, #298)

### Removed

- **Dead Code** - Removed unused code and redundant exports (#260)
- **Unused PlatformAdapterFactory** - Cleaned up unused abstractions (#270)

### Developer Experience

- **Test Coverage Improvements** - Large-scale unit test and integration test enhancements (#262)
- **Missing Module Tests** - Added unit tests for previously untested modules (#290)

## [0.3.0] - 2026-02-27

### Highlights

**Bootstrap Development Achieved** - The project can now automatically track, analyze, and develop issues with minimal human intervention through the skill system.

### Added

- **Bootstrap Development Support** - Skills for effective GitHub CLI usage to analyze tasks and submit results (#36)
- **AgentFactory** - Unified agent creation pattern for consistent agent instantiation (#129, #131, #134)
- **PlatformAdapter Pattern** - Multi-platform support foundation (#167, #186)
- **Node-to-Node File Transfer** - Support for transferring files between execution and communication nodes (#94)
- **SDK Debug Logging** - Configurable `sdkDebug` option for SDK debug output (#183)
- **Task File Watcher** - Simplified task execution using file system watcher instead of MCP trigger (#128, #130)
- **Schedule Skill Enhancements** - CRUD operations for scheduled tasks (#144)

### Changed

- **Architecture Refactoring Phase 1-4** - Major codebase restructuring for better modularity
  - Phase 1: BaseChannel abstraction (#173)
  - Phase 2: Feishu module decoupling with Adapter interfaces (#175)
  - Phase 3: Core component extraction from feishu module (#166, #176)
  - Phase 4: PlatformAdapter pattern implementation (#186)
- **Simplified Scheduler** - Removed MCP dependency, uses Skills directly (#123, #126)
- **Simplified Error Handling** - Streamlined error handling system (#138, #140)
- **ThreadId Processing** - Simplified to use message_id directly (#169, #172)
- **Pilot State System** - Removed redundant fields, uses SDK streamInput (#161, #170, #174)
- **Task Skill Renamed** - Renamed to "deep-task" for clarity (#216)

### Fixed

- **Thread Reply Issues** - Bot messages now properly form threads using reply() method (#158, #177, #182, #192)
- **Context Preservation** - Conversation context preserved across multiple turns (#120, #185)
- **Schedule Task Execution** - Fixed infinite recursion and channel issues (#102, #109)
- **WebSocket Race Condition** - Fixed connection conflicts causing node disconnections (#41, #81, #180)
- **Pino-Vitest Compatibility** - Fixed timeout and compatibility issues (#115)
- **Docker Build Performance** - Optimized using COPY --chown (#116)
- **Static Analysis Issues** - Resolved TypeScript and ESLint warnings (#156)
- **Task/Schedule Skill Disambiguation** - Clearer trigger patterns (#191, #214)

### Removed

- **MCP-based Task Trigger** - Replaced with file watcher approach (#128, #130)
- **MCP-based Schedule Tools** - Simplified to use basic tools directly (#123, #126)
- **Skill Loader** - No longer needed for skill loading (#190)
- **Transport Abstraction** - Removed unused abstraction layer (#136)
- **ExecutionNode** - Functionality moved to other components (#136)
- **CLI Mode** - No longer needed (#215)
- **Redundant Methods** - Removed clearQueue and resetAll (#189, #196)

### Developer Experience

- **Better Test Coverage** - Improved unit tests with reduced timeout issues (#162)
- **Code Cleanup** - Removed redundant types and low-value tests (#133)
- **Documentation** - Added contributing guidelines (#97)

## [0.2.4] - 2026-02-23

### Fixed

- Fixed scheduled task execution in execution node (#114)
- Fixed thread reply functionality

## [0.2.3] - 2026-02-22

### Added

- Basic task execution system
- Schedule management via MCP tools
- Feishu channel support

## [0.2.0] - 2026-02-20

### Added

- Initial multi-agent architecture
- Pilot, Executor, Evaluator, Reporter agents
- Task flow orchestration

## [0.1.0] - 2026-02-15

### Added

- Initial release
- Basic Feishu bot functionality
- CLI interface
