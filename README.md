# OpenFGA TypeScript Types Generator

🔧 **A powerful CLI tool that generates type-safe TypeScript definitions from OpenFGA authorization models.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue.svg)](https://www.typescriptlang.org/)
[![OpenFGA](https://img.shields.io/badge/OpenFGA-0.9.0-green.svg)](https://openfga.dev/)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Generated Types](#generated-types)
- [CLI Usage](#cli-usage)
- [Example Authorization Model](#example-authorization-model)
- [Package Distribution](#package-distribution)
- [Advanced Integration](#advanced-integration)
- [Development](#development)
- [License](#license)

## 🎯 Overview

The OpenFGA TypeScript Types Generator automatically creates comprehensive TypeScript type definitions from your OpenFGA authorization models. It ensures type safety when working with OpenFGA in TypeScript projects by generating object types, relation types, tuple keys, and utility functions that match your exact authorization schema.

## ✨ Features

- **🔒 Type-Safe**: Generates discriminated union types that prevent invalid object-relation combinations
- **🚀 CLI Tool**: Simple command-line interface with configurable options
- **📦 SDK Compatible**: Generates types that work seamlessly with the OpenFGA SDK
- **🎯 Comprehensive**: Creates object types, relations, tuple keys, and utility functions
- **⚡ Fast**: Fetches the latest or specific authorization models directly from OpenFGA
- **🔧 Configurable**: Customizable output paths, file names, and generation options
- **📚 Well-Documented**: Generated code includes detailed comments and metadata

## 📦 Installation

### Global Installation

```bash
npm install -g openfga-types-gen
```

### Local Installation

```bash
npm install --save-dev openfga-types-gen
```

### Development Dependencies

```bash
npm install
```

## 🚀 Quick Start

1. **Create a configuration file** (`openfga-types.config.json`):

```json
{
  "storeId": "your-store-id",
  "apiUrl": "http://localhost:8080",
  "outputPath": "./src/types",
  "outputFileName": "fga-types.ts"
}
```

2. **Run the generator**:

```bash
openfga-types-gen
```

3. **Use the generated types** in your TypeScript code:

```typescript
import { FGATupleKey, FGAObjectType, createTupleKeyBuilder } from './types/fga-types';

// Type-safe tuple creation
const userBuilder = createTupleKeyBuilder('user');
const tuple: FGATupleKey = userBuilder('user123', 'owner', 'user:alice');
```

## ⚙️ Configuration

The tool supports configuration via both configuration files and environment variables. Configuration files take precedence over environment variables.

### Configuration File Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `storeId` | `string` | ✅ | - | Your OpenFGA store ID |
| `apiUrl` | `string` | ✅ | - | OpenFGA API URL (e.g., `http://localhost:8080`) |
| `authorizationModelId` | `string` | ❌ | Latest model | Specific authorization model ID (uses latest if not provided) |
| `outputPath` | `string` | ❌ | `./generated` | Directory to output generated files |
| `outputFileName` | `string` | ❌ | `fga-types.ts` | Name of the generated TypeScript file |
| `apiToken` | `string` | ❌ | - | API token for authenticated requests |

### Environment Variables

You can also configure the tool using environment variables. These are used as fallbacks when no config file exists or when specific values are not set in the config file.

| Environment Variable | Corresponding Config Option | Description |
|---------------------|----------------------------|-------------|
| `FGA_STORE_ID` | `storeId` | Your OpenFGA store ID |
| `FGA_API_URL` | `apiUrl` | OpenFGA API URL |
| `FGA_MODEL_ID` | `authorizationModelId` | Specific authorization model ID |
| `FGA_OUTPUT_PATH` | `outputPath` | Directory to output generated files |
| `FGA_OUTPUT_FILE` | `outputFileName` | Name of the generated TypeScript file |
| `FGA_API_TOKEN` | `apiToken` | API token for authenticated requests |

### Configuration Priority

The configuration is loaded in the following priority order:
1. **Config file values** (highest priority)
2. **Environment variables** 
3. **Default values** (lowest priority)

### Example Configuration

**Using a config file (`openfga-types.config.json`):**
```json
{
  "storeId": "01K0XR4EYFE9TZSZJ9V7A1R06H",
  "authorizationModelId": "01K0XR8QKKDAAXQM0HZ3QJM3SJ",
  "apiUrl": "http://localhost:8080",
  "outputPath": "./src/generated",
  "outputFileName": "fga-types.ts",
  "apiToken": "your-api-token"
}
```

**Using environment variables (`.env` file):**
```bash
FGA_STORE_ID=01K0XR4EYFE9TZSZJ9V7A1R06H
FGA_API_URL=http://localhost:8080
FGA_MODEL_ID=01K0XR8QKKDAAXQM0HZ3QJM3SJ
FGA_OUTPUT_PATH=./src/generated
FGA_OUTPUT_FILE=fga-types.ts
FGA_API_TOKEN=your-api-token
```

## 📝 Generated Types

The generator creates comprehensive TypeScript definitions including:

### Object Type Constants and Types

```typescript
// Individual object type constants
export const FGAObjectUser = 'user' as const;
export const FGAObjectOrganization = 'organization' as const;
export const FGAObjectTeam = 'team' as const;

// Union type of all object types
export type FGAObjectType = typeof FGAObjectUser | typeof FGAObjectOrganization | typeof FGAObjectTeam;
```

### Relation Types by Object

```typescript
// Relations for each object type
export const FGAOrganizationRelationConstants = {
  owner: 'owner' as const,
  admin: 'admin' as const,
  member: 'member' as const,
  can_create_team: 'can_create_team' as const,
  can_manage_games: 'can_manage_games' as const,
} as const;

export type FGAOrganizationRelations = typeof FGAOrganizationRelationConstants[keyof typeof FGAOrganizationRelationConstants];
```

### Type-Safe Tuple Keys

```typescript
// Discriminated union that constrains relations based on object type
export type FGATupleKey =
  | { object: `user:${string}`; relation: FGAUserRelations; user: string; condition?: RelationshipCondition }
  | { object: `organization:${string}`; relation: FGAOrganizationRelations; user: string; condition?: RelationshipCondition }
  | { object: `team:${string}`; relation: FGATeamRelations; user: string; condition?: RelationshipCondition };
```

### Utility Functions

```typescript
export function formatFGAObjectId<T extends FGAObjectType>(object: { type: T, id: string }): `${T}:${string}`;

export function parseFGAObjectId(objectId: string): { type: FGAObjectType, id: string } | null;

export function createTupleKey<T extends FGAObjectType>(
  objectType: T,
  objectId: string,
  relation: (typeof relationsByObjectType)[T][number],
  user: string,
  condition?: RelationshipCondition,
)

// Validation functions
export function isValidRelationForObjectType(objectType: FGAObjectType, relation: string): boolean;
```

### Model Metadata

```typescript
export const FGAModelMetadata = {
  modelId: '01K0XR8QKKDAAXQM0HZ3QJM3SJ',
  schemaVersion: '1.1',
  objectTypes: ['user', 'organization', 'team'] as const,
  relations: ['owner', 'admin', 'member'] as const,
  relationsByObject: { /* ... */ },
  relationCategories: {
    direct: [...],
    computed: [...],
    inherited: [...],
    indirect: [...]
  },
  generatedAt: '2025-07-24T12:00:00.000Z' as const,
} as const;
```

## 🖥️ CLI Usage

### Basic Usage

```bash
# Use default config file (openfga-types.config.json)
openfga-types-gen

# Specify custom config file
openfga-types-gen --config my-config.json
openfga-types-gen -c my-config.json

# Show help
openfga-types-gen --help
openfga-types-gen -h
```

### NPM Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "types:generate": "openfga-types-gen",
    "types:generate:dev": "openfga-types-gen --config openfga-types.dev.config.json",
    "types:generate:prod": "openfga-types-gen --config openfga-types.prod.config.json"
  }
}
```

## 💡 Example Authorization Model

Given this OpenFGA model:

```openfga
model
  schema 1.1

type user

type organization
  relations
    define owner: [user]
    define admin: [user] or owner
    define member: [user] or admin

type game
  relations
    define owner: [user, organization]
    define developer: [user]
    define can_view: developer or member from owner
    define can_edit: developer or admin from owner
```

## � Package Distribution

### Creating an NPM Package

To distribute your generated types as an NPM package for use across multiple projects:

```bash
# Build the project
npm run build

# Create a package tarball
npm pack

# This creates a .tgz file that can be shared or published
```

### Publishing to NPM Registry

```bash
# Login to NPM (one time setup)
npm login

# Publish the package
npm publish

# For scoped packages
npm publish --access public
```

### Installing from Tarball

```bash
# Install from local tarball
npm install ./openfga-types-gen-1.0.0.tgz

# Install from remote tarball
npm install https://registry.npmjs.org/openfga-types-gen/-/openfga-types-gen-1.0.0.tgz
```

## �🔧 Advanced Integration

### Type Declaration Merging with OpenFGA SDK

You can enhance the OpenFGA SDK by redeclaring the `TupleKey` type to use your generated types for better type safety:

```typescript
// types/openfga-augmentation.d.ts
import type { FGATupleKey } from './fga-types';

declare module '@openfga/sdk' {
  // Redeclare TupleKey to use our generated type-safe version
  interface TupleKey extends FGATupleKey {}
  
  // Optional: Extend other SDK types for better integration
  interface WriteRequest {
    writes: FGATupleKey[];
    deletes?: FGATupleKey[];
  }
  
  interface CheckRequest {
    tuple_key: FGATupleKey;
    contextual_tuples?: FGATupleKey[];
  }
}
```

### Using the Augmented Types

```typescript
import { OpenFgaApi, Configuration } from '@openfga/sdk';
import { FGATupleKey, createTupleKeyBuilder } from './types/fga-types';
// Import the augmentation (ensure it's loaded)
import './types/openfga-augmentation';

const fgaApi = new OpenFgaApi(configuration);

// Now the SDK methods automatically use your type-safe TupleKey
const gameBuilder = createTupleKeyBuilder('game');
const tuple = gameBuilder('game123', 'owner', 'user:alice');

// TypeScript will enforce type safety on all SDK operations
await fgaApi.write('store-id', {
  writes: [tuple] // ✅ Fully type-safe, no casting needed
});

// Invalid relations will be caught at compile time
const invalidTuple = gameBuilder('game123', 'invalid_relation', 'user:alice'); // ❌ TypeScript error
```

### Project-Wide Type Safety Setup

```typescript
// src/lib/fga-client.ts
import { OpenFgaApi, Configuration } from '@openfga/sdk';
import { FGATupleKey, FGAModelMetadata } from '../types/fga-types';
import '../types/openfga-augmentation'; // Load type augmentation

export class TypeSafeFGAClient {
  private client: OpenFgaApi;
  
  constructor(config: Configuration) {
    this.client = new OpenFgaApi(config);
  }
  
  // All methods now use type-safe FGATupleKey automatically
  async writeRelation(tuple: FGATupleKey) {
    return this.client.write(FGAModelMetadata.modelId, {
      writes: [tuple]
    });
  }
  
  async checkPermission(tuple: FGATupleKey) {
    return this.client.check(FGAModelMetadata.modelId, {
      tuple_key: tuple
    });
  }
  
  async deleteRelation(tuple: FGATupleKey) {
    return this.client.write(FGAModelMetadata.modelId, {
      deletes: [tuple]
    });
  }
}
```

## 🔧 Development

### Prerequisites

- Node.js 18+
- TypeScript 5.8+
- OpenFGA server instance

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/openfga-types-gen.git
cd openfga-types-gen

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

### Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run dev` | Run the CLI in development mode with tsx |
| `npm run start` | Run the compiled CLI |
| `npm run generate` | Build and run the generator |
| `npm pack` | Create a distributable tarball |

### Project Structure

```
src/
├── cli.ts              # CLI entry point
├── index.ts            # Main generator logic and configuration
└── type-generator.ts   # Core type generation engine
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 🐛 Issues

If you encounter any issues or have feature requests, please open an issue on the GitHub repository.

## 📖 Learn More

- [OpenFGA Documentation](https://openfga.dev/docs)
- [OpenFGA TypeScript SDK](https://github.com/openfga/js-sdk)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
