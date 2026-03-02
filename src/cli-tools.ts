import { OpenFgaApi, Configuration, CredentialsMethod, AuthorizationModel } from "@openfga/sdk";
import { transformer } from "@openfga/syntax-transformer";
import { TypeGenerator } from "./type-generator.js";
import { parseAuthorizationModel } from "./model-parser.js";
import { promises as fs } from "fs";
import path from "path";

export interface GeneratorConfig {
  /** Path to a local .fga DSL file or a JSON authorization model file. When set, storeId and apiUrl are not required. */
  modelFile?: string;
  storeId?: string;
  apiUrl?: string;
  apiToken?: string;
  authorizationModelId?: string;
  outputPath: string;
  outputFileName: string;
  /** When true, also runs the model parser and writes a JSON file. Default: false. */
  parseModel: boolean;
  /** Output file name for the parsed model JSON. Default: parsed.json */
  parsedOutputFileName: string;
}

// CLI argument parsing
const parseCliArgs = (): {
  help?: boolean;
  config?: string;
  modelFile?: string;
  outputPath?: string;
  outputFileName?: string;
  parseModel?: boolean;
  parsedOutputFileName?: string;
} => {
  const args = process.argv.slice(2);
  const result: {
    help?: boolean;
    config?: string;
    modelFile?: string;
    outputPath?: string;
    outputFileName?: string;
    parseModel?: boolean;
    parsedOutputFileName?: string;
  } = {};

  const requireValue = (flag: string, index: number): string => {
    const value = args[index + 1];
    if (value === undefined || value.startsWith("-")) {
      console.error(`❌ Flag "${flag}" requires a value but none was provided.`);
      process.exit(1);
    }
    return value;
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--config" || arg === "-c") {
      result.config = requireValue(arg, i);
      i++;
    } else if (arg === "--model-file" || arg === "-m") {
      result.modelFile = requireValue(arg, i);
      i++;
    } else if (arg === "--output-path" || arg === "-o") {
      result.outputPath = requireValue(arg, i);
      i++;
    } else if (arg === "--output-file" || arg === "-f") {
      result.outputFileName = requireValue(arg, i);
      i++;
    } else if (arg === "--parse-model" || arg === "-p") {
      result.parseModel = true;
    } else if (arg === "--parsed-file" || arg === "-P") {
      result.parsedOutputFileName = requireValue(arg, i);
      i++;
    }
  }

  return result;
};

const showHelp = () => {
  console.log(`
🔧 OpenFGA TypeScript Types Generator

Usage: openfga-types-gen [options]

Options:
  -h, --help                    Show this help message
  -c, --config <file>           Specify config file (default: openfga-types.config.json)
  -m, --model-file <file>       Path to a local .fga DSL, .json model or .mod
  -o, --output-path <dir>       Output directory for generated types (default: ./generated)
  -f, --output-file <filename>  Output file name (default: fga-types.ts)
  -p, --parse-model             Also parse the model and write a JSON file (default: false)
  -P, --parsed-file <filename>  Output file name for the parsed model JSON (default: fga-model-parsed.json)

Examples:
  openfga-types-gen
  openfga-types-gen --config my-config.json
  openfga-types-gen --model-file ./model.fga
  openfga-types-gen --model-file ./model.fga --output-path ./src/types --output-file fga.ts
  openfga-types-gen --model-file ./authorization-model.json
  openfga-types-gen --model-file ./model.fga --parse-model
  openfga-types-gen --model-file ./model.fga --parse-model --parsed-file my-parsed.json

Configuration file format (JSON):

  # Option A – local model file (no API connection needed):
  {
    "modelFile": "./model.fga",
    "outputPath": "./generated",
    "outputFileName": "fga-types.ts",
    "parseModel": true,
    "parsedOutputFileName": "fga-model-parsed.json"
  }

  # Option B – fetch model from a running OpenFGA server:
  {
    "storeId": "your-store-id",
    "apiUrl": "http://localhost:8080",
    "authorizationModelId": "optional-specific-model-id",
    "outputPath": "./generated",
    "outputFileName": "fga-types.ts",
    "apiToken": "optional-token"
  }

Environment Variables (used as fallback if config file is missing or values are not set):
  FGA_MODEL_FILE         Path to a local .fga or .json model file (optional)
  FGA_STORE_ID           Store ID for OpenFGA
  FGA_API_URL            API URL for OpenFGA server
  FGA_MODEL_ID           Authorization model ID (optional)
  FGA_OUTPUT_PATH        Output directory path (default: ./generated)
  FGA_OUTPUT_FILE        Output file name (default: fga-types.ts)
  FGA_API_TOKEN          API token for authentication (optional)
  FGA_PARSE_MODEL        Set to "true" to also parse the model and write a JSON file (default: false)
  FGA_PARSED_FILE        Output file name for the parsed model JSON (default: fga-model-parsed.json)

Configuration priority: CLI flag > config file > environment variables > defaults
Input priority: --model-file (or modelFile) takes precedence over API connection settings.

For more information, visit: https://github.com/your-repo/openfga-types-generator
`);
};

const loadConfigFromEnv = (): Partial<GeneratorConfig> => {
  const config: Partial<GeneratorConfig> = {};

  if (process.env.FGA_MODEL_FILE) {
    config.modelFile = process.env.FGA_MODEL_FILE;
  }

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

  if (process.env.FGA_PARSE_MODEL === "true") {
    config.parseModel = true;
  }

  if (process.env.FGA_PARSED_FILE) {
    config.parsedOutputFileName = process.env.FGA_PARSED_FILE;
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
  const fullConfigPath = path.resolve(process.cwd(), configPath);

  // Start with environment variables as base
  let config: Partial<GeneratorConfig> = loadConfigFromEnv();

  // Try to load and merge config file if it exists
  try {
    const configFile = await fs.readFile(fullConfigPath, "utf-8");
    const fileConfig = JSON.parse(configFile);

    // Config file values override environment variables
    config = { ...config, ...fileConfig };

    console.log(`📄 Config loaded from: ${configPath}`);
  } catch (error) {
    const isNotFound = typeof error === "object" && error !== null && (error as NodeJS.ErrnoException).code === "ENOENT";
    const configExplicitlyProvided = !!cliArgs.config;

    if (!isNotFound) {
      // File exists but could not be read or parsed — always fail fast.
      console.error(`❌ Failed to load config file: ${fullConfigPath}`);
      console.error(error instanceof SyntaxError ? `   Invalid JSON: ${error.message}` : `   ${String(error)}`);
      process.exit(1);
    }

    if (configExplicitlyProvided) {
      // User explicitly passed --config but the file doesn't exist — fail fast.
      console.error(`❌ Config file not found: ${fullConfigPath}`);
      process.exit(1);
    }

    // Default config file simply isn't present — fall back to env vars / CLI flags.
    const hasFileSource = cliArgs.modelFile || config.modelFile;
    const hasApiSource = config.storeId && config.apiUrl;

    if (hasFileSource || hasApiSource) {
      console.log("📡 Using configuration from environment variables or CLI flags");
    } else {
      console.error(`❌ No config file found at: ${fullConfigPath}`);
      console.error("");
      console.error("You must provide either:");
      console.error("  A) A local model file:  --model-file ./model.fga  (or modelFile in config)");
      console.error("  B) An OpenFGA server:   FGA_STORE_ID + FGA_API_URL  (or storeId + apiUrl in config)");
      console.error("");
      console.error("Use --help for more information.");
      process.exit(1);
    }
  }

  // CLI flags take highest precedence
  if (cliArgs.modelFile) {
    config.modelFile = cliArgs.modelFile;
  }
  if (cliArgs.outputPath) {
    config.outputPath = cliArgs.outputPath;
  }
  if (cliArgs.outputFileName) {
    config.outputFileName = cliArgs.outputFileName;
  }
  if (cliArgs.parseModel) {
    config.parseModel = true;
  }
  if (cliArgs.parsedOutputFileName) {
    config.parsedOutputFileName = cliArgs.parsedOutputFileName;
  }

  // Validate: need either a model file OR (storeId + apiUrl)
  if (!config.modelFile && !config.storeId) {
    console.error("❌ Missing required configuration.");
    console.error("Provide either --model-file <path> or set storeId (FGA_STORE_ID) in config.");
    process.exit(1);
  }

  if (!config.modelFile && !config.apiUrl) {
    console.error("❌ Missing required field: apiUrl");
    console.error("Set FGA_API_URL environment variable or provide it in config file.");
    process.exit(1);
  }

  // Apply defaults for optional fields
  return {
    modelFile: config.modelFile,
    storeId: config.storeId,
    apiUrl: config.apiUrl,
    authorizationModelId: config.authorizationModelId,
    outputPath: config.outputPath || "./generated",
    outputFileName: config.outputFileName || "fga-types.ts",
    apiToken: config.apiToken,
    parseModel: config.parseModel ?? false,
    parsedOutputFileName: config.parsedOutputFileName || "fga-model-parsed.json",
  };
};

/**
 * Loads an AuthorizationModel from a local .fga DSL, .json, or .fga.mod modular model.
 * Also accepts a directory path, in which case it looks for a fga.mod file inside it.
 */
const loadModelFromFile = async (filePath: string): Promise<AuthorizationModel> => {
  let fullPath = path.resolve(process.cwd(), filePath);

  // If a directory is given, look for fga.mod inside it
  const stat = await fs.stat(fullPath).catch(() => null);
  if (stat?.isDirectory()) {
    fullPath = path.join(fullPath, "fga.mod");
    console.log(`📁 Directory detected, looking for fga.mod: ${fullPath}`);
  }

  const ext = path.extname(fullPath).toLowerCase();
  console.log(`📂 Loading model from file: ${fullPath}`);

  const content = await fs.readFile(fullPath, "utf-8");

  if (ext === ".mod") {
    // ── Modular model (fga.mod manifest + module .fga files) ─────────────
    const manifest = transformer.transformModFileToJSON(content);

    const schemaVersion: string = manifest.schema?.value ?? "1.2";
    const moduleFiles: string[] = (manifest.contents?.value ?? []).map((entry) => entry.value);

    if (moduleFiles.length === 0) {
      throw new Error("fga.mod file has no contents entries.");
    }

    const manifestDir = path.dirname(fullPath);

    // Read all module files relative to the manifest directory
    const files = await Promise.all(
      moduleFiles.map(async (name) => ({
        name,
        contents: await fs.readFile(path.join(manifestDir, name), "utf-8"),
      }))
    );

    const model = transformer.transformModuleFilesToModel(files, schemaVersion);
    console.log(`🧩 Transformed modular model (schema: ${schemaVersion}, modules: ${moduleFiles.join(", ")})`);
    return model as AuthorizationModel;
  } else if (ext === ".fga") {
    // Convert FGA DSL to JSON using @openfga/syntax-transformer
    const jsonModel = transformer.transformDSLToJSONObject(content);
    console.log(`🔄 Transformed DSL model (schema: ${jsonModel.schema_version})`);
    return jsonModel as AuthorizationModel;
  } else if (ext === ".json") {
    const parsed = JSON.parse(content);
    // Support both a bare AuthorizationModel object and a wrapped { authorization_model: ... } shape
    const model: AuthorizationModel = parsed.authorization_model ?? parsed;
    if (!model.schema_version || !model.type_definitions) {
      throw new Error(
        `The JSON file does not appear to be a valid AuthorizationModel. ` + `Expected fields: schema_version, type_definitions.`
      );
    }
    console.log(`📋 Loaded JSON model (schema: ${model.schema_version})`);
    return model;
  } else {
    throw new Error(
      `Unsupported file extension "${ext}". Use .fga for DSL files, .json for JSON model files, or .mod for modular models (fga.mod).`
    );
  }
};

export const generateTypes = async () => {
  const config = await loadConfig();

  try {
    let authorizationModel: AuthorizationModel;

    if (config.modelFile) {
      // ── Local file path (DSL or JSON) ────────────────────────────────────
      authorizationModel = await loadModelFromFile(config.modelFile);
    } else {
      // ── Fetch from running OpenFGA server ────────────────────────────────
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

      console.log("Fetching authorization model...");

      const response = config.authorizationModelId
        ? await fgaApi.readAuthorizationModel(config.storeId!, config.authorizationModelId)
        : await fgaApi.readAuthorizationModels(config.storeId!, 1).then(async (models) => {
            if (!models.authorization_models || models.authorization_models.length === 0) {
              throw new Error("No authorization models found");
            }
            const latestModel = models.authorization_models[0];
            return fgaApi.readAuthorizationModel(config.storeId!, latestModel.id!);
          });

      if (!response.authorization_model) {
        throw new Error("No authorization model found");
      }

      authorizationModel = response.authorization_model;
      console.log(`Found authorization model: ${authorizationModel.id}`);
      console.log(`Schema version: ${authorizationModel.schema_version}`);
    }

    // Generate TypeScript types
    const generator = new TypeGenerator();
    const typeDefinitions = generator.generateTypes(authorizationModel);

    // Write to file
    const outputPath = config.outputPath;
    const outputFileName = config.outputFileName;
    const fullOutputPath = path.resolve(process.cwd(), outputPath);
    const fullOutputFile = path.join(fullOutputPath, outputFileName);

    // Ensure output directory exists
    await fs.mkdir(fullOutputPath, { recursive: true });

    // Write the generated types
    await fs.writeFile(fullOutputFile, typeDefinitions, "utf-8");

    console.log(`✅ Types generated successfully!`);
    console.log(`📁 Output: ${fullOutputFile}`);
    if (authorizationModel.id) {
      console.log(`📊 Model ID: ${authorizationModel.id}`);
    }

    // ── Optional: parse the model and write a JSON file ──────────────────
    if (config.parseModel) {
      const parsedModel = parseAuthorizationModel(authorizationModel);
      const parsedOutputFile = path.join(fullOutputPath, config.parsedOutputFileName);
      await fs.writeFile(parsedOutputFile, JSON.stringify(parsedModel, null, 2), "utf-8");
      console.log(`🔍 Parsed model written to: ${parsedOutputFile}`);
    }
  } catch (error) {
    console.error("❌ Error generating types:", error);
    process.exit(1);
  }
};
