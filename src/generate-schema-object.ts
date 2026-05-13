import type { DMMF as PrismaDMMF } from '@prisma/generator-helper';
import path from 'path';
import { OptionalKind, Project, PropertyDeclarationStructure } from 'ts-morph';
import type { GeneratorConfig } from './prisma-generator';
import {
  generateClassTransformerImport,
  generateClassValidatorImport,
  generateEnumImports,
  generateHelpersImports,
  generatePrismaImport,
  generateRelationImportsImport,
  generateSwaggerImport,
  getDecoratorsByFieldType,
  getDecoratorsImportsByType,
  getSwaggerImportsByType,
  getTSDataTypeFromFieldType,
  shouldImportClassTransformer,
  shouldImportHelpers,
  shouldImportPrisma,
  shouldImportSwagger,
} from './helpers';

export default async function generateSchemaObject(
  project: Project,
  config: GeneratorConfig,
  type: any,
  outputDirName: 'inputs' | 'outputs',
) {
  const dirPath = path.resolve(config.outputDir, outputDirName);
  const filePath = path.resolve(dirPath, `${type.name}.${outputDirName.slice(0, -1)}.ts`);
  const sourceFile = project.createSourceFile(filePath, undefined, {
    overwrite: true,
  });

  const fields = (type.fields as any[]).map((field) => {
    if ('inputTypes' in field) {
      // InputObjectType field
      const inputType = field.inputTypes[0];
      return {
        name: field.name,
        type: inputType.type as string,
        isRequired: field.isRequired,
        isList: inputType.isList,
        kind: inputType.location === 'enumTypes' ? 'enum' : (inputType.location === 'inputObjectTypes' ? 'object' : 'scalar'),
        hasDefaultValue: false,
      } as PrismaDMMF.Field;
    } else {
      // OutputObjectType field
      return {
        name: field.name,
        type: field.outputType.type as string,
        isRequired: true, // Output fields are generally considered required in this context
        isList: field.outputType.isList,
        kind: field.outputType.location === 'enumTypes' ? 'enum' : (field.outputType.location === 'outputObjectTypes' ? 'object' : 'scalar'),
        hasDefaultValue: false,
      } as PrismaDMMF.Field;
    }
  });

  const validatorImports = [
    ...new Set(
      fields
        .map((field) => getDecoratorsImportsByType(field))
        .flatMap((item) => item),
    ),
  ];

  if (shouldImportPrisma(fields)) {
    generatePrismaImport(sourceFile, config);
  }

  generateClassValidatorImport(sourceFile, validatorImports as Array<string>);

  if (shouldImportClassTransformer(fields as PrismaDMMF.Field[])) {
    generateClassTransformerImport(sourceFile);
  }

  if (config.swagger && shouldImportSwagger(fields)) {
    const swaggerImports = getSwaggerImportsByType(fields);
    generateSwaggerImport(sourceFile, swaggerImports);
  }

  const relationImports = new Set<string>();
  fields.forEach((field: PrismaDMMF.Field) => {
    if (field.kind === 'object' && type.name !== field.type) {
      relationImports.add(field.type);
    }
  });

  generateRelationImportsImport(sourceFile, [...relationImports]);

  if (shouldImportHelpers(fields)) {
    generateHelpersImports(sourceFile, ['getEnumValues']);
  }

  generateEnumImports(sourceFile, fields);

  sourceFile.addClass({
    name: type.name,
    isExported: true,
    properties: fields.map<OptionalKind<PropertyDeclarationStructure>>((field: PrismaDMMF.Field) => {
      return {
        name: field.name,
        type: getTSDataTypeFromFieldType(field),
        hasExclamationToken: field.isRequired,
        hasQuestionToken: !field.isRequired,
        trailingTrivia: '\r\n',
        decorators: getDecoratorsByFieldType(field, config.swagger),
      };
    }),
  });
}
