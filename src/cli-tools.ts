import { OpenFgaApi, Configuration, CredentialsMethod } from "@openfga/sdk";
import { TypeGenerator } from "./type-generator.js";
import { promises as fs } from "fs";
import path from "path";

export interface GeneratorConfig {
  storeId: string;
  apiUrl: string;
  authorizationModelId?: string;
  outputPath?: string;
  outputFileName?: string;
  apiToken?: string;
}

// CLI argument parsing
const parseCliArgs = (): { help?: boolean; config?: string } => {
  const args = process.argv.slice(2);
  const result: { help?: boolean; config?: string } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--config" || arg === "-c") {
      result.config = args[i + 1];
      i++; // Skip next argument as it's the config value
    }
  }

  return result;
};

const showHelp = () => {
  console.log(`
🔧 OpenFGA TypeScript Types Generator

Usage: openfga-types-gen [options]

Options:
  -h, --help              Show this help message
  -c, --config <file>     Specify config file (default: openfga-types.config.json)

Example:
  openfga-types-gen
  openfga-types-gen --config my-config.json

Configuration file format (JSON):
{
  "storeId": "your-store-id",
  "apiUrl": "http://localhost:8080",
  "authorizationModelId": "optional-specific-model-id",
  "outputPath": "./generated",
  "outputFileName": "fga-types.ts",
  "apiToken": "optional-token",
}

Environment Variables (used as fallback if config file is missing or values are not set):
  FGA_STORE_ID           Store ID for OpenFGA
  FGA_API_URL            API URL for OpenFGA server
  FGA_MODEL_ID           Authorization model ID (optional)
  FGA_OUTPUT_PATH        Output directory path (default: ./generated)
  FGA_OUTPUT_FILE        Output file name (default: fga-types.ts)
  FGA_API_TOKEN          API token for authentication (optional)

Configuration priority: config file > environment variables > defaults

For more information, visit: https://github.com/your-repo/openfga-types-generator
`);
};

const loadConfigFromEnv = (): Partial<GeneratorConfig> => {
  const config: Partial<GeneratorConfig> = {};

  if (process.env.FGA_STORE_ID) {
    config.storeId = process.env.FGA_STORE_ID;
  }

  if (process.env.FGA_API_URL) {
    config.apiUrl = process.env.FGA_API_URL;
  }

  if (process.env.FGA_MODEL_ID) {
    config.authorizationModelId = process.env.FGA_MODEL_ID;
  }

  if (process.env.FGA_OUTPUT_PATH) {
    config.outputPath = process.env.FGA_OUTPUT_PATH;
  }

  if (process.env.FGA_OUTPUT_FILE) {
    config.outputFileName = process.env.FGA_OUTPUT_FILE;
  }

  if (process.env.FGA_API_TOKEN) {
    config.apiToken = process.env.FGA_API_TOKEN;
  }

  return config;
};

const loadConfig = async (): Promise<GeneratorConfig> => {
  const cliArgs = parseCliArgs();

  if (cliArgs.help) {
    showHelp();
    process.exit(0);
  }

  const configPath = cliArgs.config || "openfga-types.config.json";

  // Start with environment variables as base
  let config: Partial<GeneratorConfig> = loadConfigFromEnv();

  // Try to load and merge config file if it exists
  try {
    const fullConfigPath = path.resolve(process.cwd(), configPath);
    const configFile = await fs.readFile(fullConfigPath, "utf-8");
    const fileConfig = JSON.parse(configFile);
    
    // Config file values override environment variables
    config = { ...config, ...fileConfig };
    
    console.log(`📄 Config loaded from: ${configPath}`);
  } catch (error) {
    // If no config file exists and we have required values from env, continue
    if (config.storeId && config.apiUrl) {
      console.log("📡 Using configuration from environment variables");
    } else {
      console.error(`❌ Error loading config file: ${configPath}`);
      console.error("Please ensure the config file exists and is valid JSON, or set required environment variables.");
      console.error("");
      console.error("Required environment variables:");
      console.error("  FGA_STORE_ID=your-store-id");
      console.error("  FGA_API_URL=http://localhost:8080");
      console.error("");
      console.error("Optional environment variables:");
      console.error("  FGA_MODEL_ID=optional-specific-model-id");
      console.error("  FGA_OUTPUT_PATH=./generated");
      console.error("  FGA_OUTPUT_FILE=fga-types.ts");
      console.error("  FGA_API_TOKEN=optional-token");
      console.error("");
      console.error("Example config file:");
      console.error(
        JSON.stringify(
          {
            storeId: "your-store-id",
            apiUrl: "http://localhost:8080",
            authorizationModelId: "optional-specific-model-id",
            outputPath: "./generated",
            outputFileName: "fga-types.ts",
          },
          null,
          2
        )
      );
      console.error("");
      console.error("Use --help for more information.");
      process.exit(1);
    }
  }

  // Validate required fields
  if (!config.storeId) {
    console.error("❌ Missing required field: storeId");
    console.error("Set FGA_STORE_ID environment variable or provide it in config file.");
    process.exit(1);
  }

  if (!config.apiUrl) {
    console.error("❌ Missing required field: apiUrl");
    console.error("Set FGA_API_URL environment variable or provide it in config file.");
    process.exit(1);
  }

  // Apply defaults for optional fields
  return {
    storeId: config.storeId,
    apiUrl: config.apiUrl,
    authorizationModelId: config.authorizationModelId,
    outputPath: config.outputPath || "./generated",
    outputFileName: config.outputFileName || "fga-types.ts",
    apiToken: config.apiToken,
  };
};

export const generateTypes = async () => {
  const config = await loadConfig();

  // Configure the OpenFGA client
  const configuration = new Configuration({
    apiUrl: config.apiUrl,
    credentials: config.apiToken
      ? {
          method: CredentialsMethod.ApiToken,
          config: {
            token: config.apiToken,
          },
        }
      : undefined,
  });

  const fgaApi = new OpenFgaApi(configuration);

  try {
    console.log("Fetching authorization model...");

    // Get the latest authorization model or specific one
    const response = config.authorizationModelId
      ? await fgaApi.readAuthorizationModel(
          config.storeId,
          config.authorizationModelId
        )
      : await fgaApi
          .readAuthorizationModels(config.storeId, 1) // pageSize as second parameter
          .then(async (models) => {
            if (
              !models.authorization_models ||
              models.authorization_models.length === 0
            ) {
              throw new Error("No authorization models found");
            }
            const latestModel = models.authorization_models[0];
            return fgaApi.readAuthorizationModel(
              config.storeId,
              latestModel.id!
            );
          });

    if (!response.authorization_model) {
      throw new Error("No authorization model found");
    }

    console.log(
      `Found authorization model: ${response.authorization_model.id}`
    );
    console.log(
      `Schema version: ${response.authorization_model.schema_version}`
    );

    // Generate TypeScript types
    const generator = new TypeGenerator();
    const typeDefinitions = generator.generateTypes(
      response.authorization_model
    );

    // Write to file
    const outputPath = config.outputPath || "./generated";
    const outputFileName = config.outputFileName || "fga-types.ts";
    const fullOutputPath = path.resolve(process.cwd(), outputPath);
    const fullOutputFile = path.join(fullOutputPath, outputFileName);

    // Ensure output directory exists
    await fs.mkdir(fullOutputPath, { recursive: true });

    // Write the generated types
    await fs.writeFile(fullOutputFile, typeDefinitions, "utf-8");

    console.log(`✅ Types generated successfully!`);
    console.log(`📁 Output: ${fullOutputFile}`);
    console.log(`📊 Model ID: ${response.authorization_model.id}`);
  } catch (error) {
    console.error("❌ Error generating types:", error);
    process.exit(1);
  }
};
