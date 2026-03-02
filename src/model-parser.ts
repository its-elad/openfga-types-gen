import type { AuthorizationModel, Condition, TypeDefinition, Userset, RelationReference } from "@openfga/sdk";

// --- Relations -------------------------------------------------------------

/** A user type that can be directly written into a tuple for a relation. */
export interface DirectUserType {
  /** OpenFGA type name, e.g. `"user"`, `"group"`. */
  type: string;
  /** When set, the subject is a userset: `group:eng#member` → `relation = "member"`. */
  relation?: string;
  /** `true` when a public wildcard (`type:*`) is allowed. */
  wildcard?: true;
  /** Condition name that must hold for the relationship to be active. */
  condition?: string;
}

export interface DirectDef {
  kind: "direct";
  allowedTypes: DirectUserType[];
}

export interface ComputedDef {
  kind: "computed";
  /** Relation on the same type whose members are inherited. */
  fromRelation: string;
}

/** Traverse a tupleset relation to a parent object, then read a relation there. */
export interface TupleToUsersetDef {
  kind: "ttu";
  /** The relation on this type that points to the parent object. */
  via: string;
  /** The relation to read on the parent object. */
  relation: string;
}

export interface UnionDef {
  kind: "union";
  /** Access granted if the user satisfies **any** child. */
  children: RelationDefinition[];
}

export interface IntersectionDef {
  kind: "intersection";
  /** Access granted only if the user satisfies **all** children. */
  children: RelationDefinition[];
}

export interface DifferenceDef {
  kind: "difference";
  base: RelationDefinition;
  subtract: RelationDefinition;
}

export type RelationDefinition =
  | DirectDef
  | ComputedDef
  | TupleToUsersetDef
  | UnionDef
  | IntersectionDef
  | DifferenceDef;

export interface ParsedRelation {
  name: string;
  definition: RelationDefinition;
}

// --- Model structure --------------------------------------------------------

export interface ParsedTypeDefinition {
  type: string;
  module?: string;
  relations: ParsedRelation[];
}

export interface ParsedModel {
  modelId?: string;
  schemaVersion: string;
  types: ParsedTypeDefinition[];
  /** Conditions keyed by name. Uses the SDK's `Condition` type directly. */
  conditions: Record<string, Condition>;
}

// --- Parsing (internal) -----------------------------------------------------

function toDirectUserType(ref: RelationReference): DirectUserType {
  const entry: DirectUserType = { type: ref.type };
  if (ref.wildcard !== undefined) entry.wildcard = true;
  if (ref.relation)               entry.relation  = ref.relation;
  if (ref.condition)              entry.condition = ref.condition;
  return entry;
}

function parseUserset(userset: Userset): RelationDefinition {
  if (userset.this !== undefined) {
    return { kind: "direct", allowedTypes: [] };
  }
  if (userset.computedUserset) {
    return { kind: "computed", fromRelation: userset.computedUserset.relation ?? "" };
  }
  if (userset.tupleToUserset) {
    return {
      kind: "ttu",
      via: userset.tupleToUserset.tupleset?.relation ?? "",
      relation: userset.tupleToUserset.computedUserset?.relation ?? "",
    };
  }
  if (userset.union) {
    return { kind: "union", children: (userset.union.child ?? []).map(parseUserset) };
  }
  if (userset.intersection) {
    return { kind: "intersection", children: (userset.intersection.child ?? []).map(parseUserset) };
  }
  if (userset.difference) {
    return {
      kind: "difference",
      base: parseUserset(userset.difference.base),
      subtract: parseUserset(userset.difference.subtract),
    };
  }
  return { kind: "direct", allowedTypes: [] };
}

/**
 * Fills `allowedTypes` on every `DirectDef` node in the tree.
 * The metadata stores a flat list of allowed types per relation, so every
 * `DirectDef` node in the tree receives the same list.
 */
function injectDirectTypes(def: RelationDefinition, allowedTypes: DirectUserType[]): RelationDefinition {
  switch (def.kind) {
    case "direct":
      return { ...def, allowedTypes };
    case "union":
    case "intersection":
      return { ...def, children: def.children.map((c) => injectDirectTypes(c, allowedTypes)) };
    case "difference":
      return {
        ...def,
        base: injectDirectTypes(def.base, allowedTypes),
        subtract: injectDirectTypes(def.subtract, allowedTypes),
      };
    default:
      return def;
  }
}

function parseTypeDefinition(typeDef: TypeDefinition): ParsedTypeDefinition {
  const metadataRelations = typeDef.metadata?.relations ?? {};
  const relations = Object.entries(typeDef.relations ?? {}).map(([name, userset]) => {
    const allowedTypes = (metadataRelations[name]?.directly_related_user_types ?? []).map(toDirectUserType);
    return { name, definition: injectDirectTypes(parseUserset(userset), allowedTypes) };
  });
  return { type: typeDef.type, module: typeDef.metadata?.module, relations };
}

// --- Public API -------------------------------------------------------------

/**
 * Parses an OpenFGA `AuthorizationModel` into a clean, traversable structure.
 */
export function parseAuthorizationModel(model: AuthorizationModel): ParsedModel {
  return {
    modelId: model.id,
    schemaVersion: model.schema_version ?? undefined,
    types: (model.type_definitions ?? []).map(parseTypeDefinition),
    conditions: model.conditions ?? {},
  };
}
