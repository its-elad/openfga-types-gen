import { OpenFgaApi, Configuration, CredentialsMethod } from "@openfga/sdk";
import { TypeGenerator } from "./type-generator.js";
import { promises as fs } from "fs";
import path from "path";

interface GeneratorConfig {
  storeId: string;
  apiUrl: string;
  authorizationModelId?: string;
  outputPath?: string;
  outputFileName?: string;
  apiToken?: string;
}

// CLI argument parsing
function parseCliArgs(): { help?: boolean; config?: string } {
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
}

function showHelp() {
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

For more information, visit: https://github.com/your-repo/openfga-types-generator
`);
}

async function loadConfig(): Promise<GeneratorConfig> {
  const cliArgs = parseCliArgs();

  if (cliArgs.help) {
    showHelp();
    process.exit(0);
  }

  const configPath = cliArgs.config || "openfga-types.config.json";

  try {
    const fullConfigPath = path.resolve(process.cwd(), configPath);
    const configFile = await fs.readFile(fullConfigPath, "utf-8");
    return JSON.parse(configFile);
  } catch (error) {
    console.error(`❌ Error loading config file: ${configPath}`);
    console.error("Please ensure the config file exists and is valid JSON.");
    console.error("");
    console.error("Example config:");
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
        2,
      ),
    );
    console.error("");
    console.error("Use --help for more information.");
    process.exit(1);
  }
}

async function generateTypes() {
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
      ? await fgaApi.readAuthorizationModel(config.storeId, config.authorizationModelId)
      : await fgaApi
          .readAuthorizationModels(config.storeId, 1) // pageSize as second parameter
          .then(async (models) => {
            if (!models.authorization_models || models.authorization_models.length === 0) {
              throw new Error("No authorization models found");
            }
            const latestModel = models.authorization_models[0];
            return fgaApi.readAuthorizationModel(config.storeId, latestModel.id!);
          });

    if (!response.authorization_model) {
      throw new Error("No authorization model found");
    }

    console.log(`Found authorization model: ${response.authorization_model.id}`);
    console.log(`Schema version: ${response.authorization_model.schema_version}`);

    // Generate TypeScript types
    const generator = new TypeGenerator();
    const typeDefinitions = generator.generateTypes(response.authorization_model);

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
}

export { generateTypes, GeneratorConfig };
