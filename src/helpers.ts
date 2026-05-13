import type { DMMF as PrismaDMMF } from '@prisma/generator-helper';
import path from 'path';
import {
  DecoratorStructure,
  ExportDeclarationStructure,
  OptionalKind,
  Project,
  SourceFile,
} from 'ts-morph';
import type { GeneratorConfig } from './prisma-generator';

export const generateModelsIndexFile = (
  prismaClientDmmf: PrismaDMMF.Document,
  project: Project,
  outputDir: string,
) => {
  const modelsBarrelExportSourceFile = project.createSourceFile(
    path.resolve(outputDir, 'models', 'index.ts'),
    undefined,
    { overwrite: true },
  );

  modelsBarrelExportSourceFile.addExportDeclarations(
    prismaClientDmmf.datamodel.models
      .map((model) => model.name)
      .sort()
      .map<OptionalKind<ExportDeclarationStructure>>((modelName) => ({
        moduleSpecifier: `./${modelName}.model.js`,
        namedExports: [modelName],
      })),
  );
};

export const generateInputsIndexFile = (
  inputTypes: any[],
  project: Project,
  outputDir: string,
) => {
  const inputsBarrelExportSourceFile = project.createSourceFile(
    path.resolve(outputDir, 'inputs', 'index.ts'),
    undefined,
    { overwrite: true },
  );

  inputsBarrelExportSourceFile.addExportDeclarations(
    inputTypes
      .map((type) => type.name)
      .sort()
      .map<OptionalKind<ExportDeclarationStructure>>((name) => ({
        moduleSpecifier: `./${name}.input.js`,
        namedExports: [name],
      })),
  );
};

export const generateOutputsIndexFile = (
  outputTypes: any[],
  project: Project,
  outputDir: string,
) => {
  const outputsBarrelExportSourceFile = project.createSourceFile(
    path.resolve(outputDir, 'outputs', 'index.ts'),
    undefined,
    { overwrite: true },
  );

  outputsBarrelExportSourceFile.addExportDeclarations(
    outputTypes
      .map((type) => type.name)
      .sort()
      .map<OptionalKind<ExportDeclarationStructure>>((name) => ({
        moduleSpecifier: `./${name}.output.js`,
        namedExports: [name],
      })),
  );
};

export const shouldImportPrisma = (fields: PrismaDMMF.Field[]) => {
  return fields.some((field) => ['Decimal', 'Json'].includes(field.type));
};

export const shouldImportClassTransformer = (fields: PrismaDMMF.Field[]) => {
  return fields.some(
    (field) => field.kind === 'object' || field.type === 'Decimal',
  );
};

export const shouldImportHelpers = (fields: PrismaDMMF.Field[]) => {
  return fields.some((field) => ['enum'].includes(field.kind));
};

export const getTSDataTypeFromFieldType = (field: PrismaDMMF.Field) => {
  let type = field.type;
  switch (field.type) {
    case 'Int':
    case 'Float':
      type = 'number';
      break;
    case 'DateTime':
      type = 'Date';
      break;
    case 'String':
      type = 'string';
      break;
    case 'Boolean':
      type = 'boolean';
      break;
    case 'Decimal':
      type = 'typeof Prisma.Decimal';
      break;
    case 'Json':
      type = 'Prisma.JsonValue';
      break;
    case 'Bytes':
      type = 'Uint8Array';
      break;
  }

  if (field.isList) {
    type = `${type}[]`;
  }

  // Add null union for optional fields to match Prisma client behavior
  if (!field.isRequired) {
    type = `${type} | null`;
  }

  return type;
};

export const getDecoratorsByFieldType = (
  field: PrismaDMMF.Field,
  includeSwagger: boolean = false,
) => {
  const decorators: OptionalKind<DecoratorStructure>[] = [];

  // Add Swagger decorators first if enabled
  if (includeSwagger) {
    const swaggerDecorator = getSwaggerDecoratorByFieldType(field);
    if (swaggerDecorator) {
      decorators.push(swaggerDecorator);
    }
  }

  // Add class-validator decorators
  switch (field.type) {
    case 'Int':
      decorators.push({
        name: 'IsInt',
        arguments: field.isList ? [`{ each:true }`] : [],
      });
      decorators.push({
        name: 'Type',
        arguments: [`() => Number`],
      });
      break;
    case 'Float':
      decorators.push({
        name: 'IsNumber',
        arguments: field.isList ? [`{ each:true }`] : [],
      });
      decorators.push({
        name: 'Type',
        arguments: [`() => Number`],
      });
      break;
    case 'DateTime':
      decorators.push({
        name: 'IsDate',
        arguments: field.isList ? [`{ each:true }`] : [],
      });
      decorators.push({
        name: 'Type',
        arguments: [`() => Date`],
      });
      break;
    case 'String':
      decorators.push({
        name: 'IsString',
        arguments: field.isList ? [`{ each:true }`] : [],
      });
      break;
    case 'Boolean':
      decorators.push({
        name: 'IsBoolean',
        arguments: field.isList ? [`{ each:true }`] : [],
      });
      decorators.push({
        name: 'Type',
        arguments: [`() => Boolean`],
      });
      break;
  }
  if (field.isRequired) {
    decorators.unshift({
      name: 'IsDefined',
      arguments: [],
    });
  } else {
    decorators.unshift({
      name: 'IsOptional',
      arguments: [],
    });
  }
  if (field.kind === 'object') {
    decorators.push({
      name: 'ValidateNested',
      arguments: field.isList ? [`{ each:true }`] : [],
    });
    decorators.push({
      name: 'Type',
      arguments: [`() => ${field.type}`],
    });
  }

  if (field.type === 'Decimal') {
    decorators.push({
      name: 'Transform',
      arguments: [`(value) => value.toString()`, `{ toPlainOnly: true }`],
    });
    decorators.push({
      name: 'Transform',
      arguments: [`(value) => new Prisma.Decimal(value)`, `{ toClassOnly: true }`],
    });
  }

  if (field.kind === 'enum') {
    decorators.push({
      name: 'IsIn',
      arguments: [`getEnumValues(${String(field.type)})`],
    });
  }
  return decorators;
};

export const getSwaggerDecoratorByFieldType = (field: PrismaDMMF.Field) => {
  const args: string[] = [];

  // Base properties
  if (field.hasDefaultValue && field.default !== null) {
    if (typeof field.default === 'object' && 'name' in field.default) {
      // Handle function defaults like autoincrement(), now()
      args.push(`example: 'Generated by ${field.default.name}'`);
    } else {
      args.push(`example: ${JSON.stringify(field.default)}`);
    }
  }

  // Type-specific properties
  switch (field.type) {
    case 'Int':
      args.push('type: "integer"');
      break;
    case 'Float':
      args.push('type: "number"');
      break;
    case 'String':
      args.push('type: "string"');
      break;
    case 'Boolean':
      args.push('type: "boolean"');
      break;
    case 'DateTime':
      args.push('type: "string"', 'format: "date-time"');
      break;
    case 'Decimal':
      args.push('type: "string"', 'description: "Decimal value as string"');
      break;
    case 'Json':
      args.push('type: Object');
      break;
    case 'Bytes':
      args.push('type: "string"', 'format: "byte"');
      break;
  }

  // Array handling
  if (field.isList) {
    args.push('isArray: true');
  }

  // Required/optional
  if (!field.isRequired) {
    args.push('required: false');
  }

  // Enum handling
  if (field.kind === 'enum') {
    args.push(`enum: Object.values(${field.type})`);
  }

  if (field.relationName) {
    args.push(`type: () => ${field.type}`);
  }

  return {
    name: 'ApiProperty',
    arguments: args.length > 0 ? [`{ ${args.join(', ')} }`] : [],
  };
};

export const getDecoratorsImportsByType = (field: PrismaDMMF.Field) => {
  const validatorImports = new Set();
  switch (field.type) {
    case 'Int':
      validatorImports.add('IsInt');
      break;
    case 'Float':
      validatorImports.add('IsNumber');
      break;
    case 'DateTime':
      validatorImports.add('IsDate');
      break;
    case 'String':
      validatorImports.add('IsString');
      break;
    case 'Boolean':
      validatorImports.add('IsBoolean');
      break;
  }
  if (field.isRequired) {
    validatorImports.add('IsDefined');
  } else {
    validatorImports.add('IsOptional');
  }
  if (field.kind === 'enum') {
    validatorImports.add('IsIn');
  }
  if (field.kind === 'object'){
    validatorImports.add('ValidateNested');
  }
  return [...validatorImports];
};

export const generateClassValidatorImport = (
  sourceFile: SourceFile,
  validatorImports: Array<string>,
) => {
  sourceFile.addImportDeclaration({
    moduleSpecifier: 'class-validator',
    namedImports: validatorImports,
  });
};

export const generateClassTransformerImport = (sourceFile: SourceFile) => {
  sourceFile.addImportDeclaration({
    moduleSpecifier: 'class-transformer',
    namedImports: ['Type', 'Transform'],
  });
};

export const generatePrismaImport = (
  sourceFile: SourceFile,
  config: GeneratorConfig,
) => {
  sourceFile.addImportDeclaration({
    moduleSpecifier: `../${config.prismaClientPath}/browser.js`,
    namedImports: ['Prisma'],
  });
};

export const generateRelationImportsImport = (
  sourceFile: SourceFile,
  relationImports: Array<string>,
) => {
  sourceFile.addImportDeclaration({
    moduleSpecifier: './index.js',
    namedImports: relationImports,
  });
};
export const generateHelpersImports = (
  sourceFile: SourceFile,
  helpersImports: Array<string>,
) => {
  sourceFile.addImportDeclaration({
    moduleSpecifier: '../helpers/index.js',
    namedImports: helpersImports,
  });
};

export const generateEnumImports = (
  sourceFile: SourceFile,
  fields: PrismaDMMF.Field[],
) => {
  const enumsToImport = fields
    .filter((field) => field.kind === 'enum')
    .map((field) => field.type);

  if (enumsToImport.length > 0) {
    sourceFile.addImportDeclaration({
      moduleSpecifier: '../enums/index.js',
      namedImports: enumsToImport,
    });
  }
};

export const shouldImportSwagger = (fields: PrismaDMMF.Field[]) => {
  return fields.length > 0; // Always import if we have fields and swagger is enabled
};

export const getSwaggerImportsByType = (fields: PrismaDMMF.Field[]) => {
  const swaggerImports = new Set(['ApiProperty']);
  // Add more swagger imports as needed
  return [...swaggerImports];
};

export const generateSwaggerImport = (
  sourceFile: SourceFile,
  swaggerImports: Array<string>,
) => {
  sourceFile.addImportDeclaration({
    moduleSpecifier: '@nestjs/swagger',
    namedImports: swaggerImports,
  });
};

export function generateEnumsIndexFile(
  sourceFile: SourceFile,
  enumNames: string[],
) {
  sourceFile.addExportDeclarations(
    enumNames.sort().map<OptionalKind<ExportDeclarationStructure>>((name) => ({
      moduleSpecifier: `./${name}.enum.js`,
      namedExports: [name],
    })),
  );
}
