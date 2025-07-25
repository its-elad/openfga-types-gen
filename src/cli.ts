#!/usr/bin/env node

import { generateTypes } from './cli-tools.js';

// CLI entry point - always run the main function
generateTypes().catch(console.error);
