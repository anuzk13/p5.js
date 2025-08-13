function getEntries(entry) {
  return [
    entry,
    ...getAllEntries(entry.members?.global || []),
    ...getAllEntries(entry.members?.inner || []),
    ...getAllEntries(entry.members?.instance || []),
    ...getAllEntries(entry.members?.events || []),
    ...getAllEntries(entry.members?.static || [])
  ];
}

export function getAllEntries(arr = []) {
  return arr.flatMap(entry => entry ? getEntries(entry) : []);
}
export function normalizeClassName(className) {
  if (!className || className === 'p5') return 'p5';
  return className.startsWith('p5.') ? className : `p5.${className}`;
}

// Helper function to check if a name is a reserved keyword in TypeScript
export function isReservedKeyword(name) {
  const reservedKeywords = [
    'abstract', 'any', 'as', 'asserts', 'bigint', 'boolean', 'break',
    'case', 'catch', 'class', 'const', 'continue', 'debugger', 'declare',
    'default', 'delete', 'do', 'else', 'enum', 'export', 'extends',
    'false', 'finally', 'for', 'from', 'function', 'get', 'global',
    'if', 'implements', 'import', 'in', 'infer', 'instanceof', 'interface',
    'intrinsic', 'is', 'keyof', 'let', 'module', 'namespace', 'never',
    'new', 'null', 'number', 'object', 'of', 'package', 'private',
    'protected', 'public', 'readonly', 'require', 'return', 'set',
    'static', 'string', 'super', 'switch', 'symbol', 'this', 'throw',
    'true', 'try', 'type', 'typeof', 'undefined', 'unique', 'unknown',
    'var', 'void', 'while', 'with', 'yield'
  ];
  return reservedKeywords.includes(name);
}

// Helper function to check if a name is a valid TypeScript identifier
export function isValidIdentifier(name) {
  if (!name || typeof name !== 'string') return false;
  // Check if it's a valid identifier (starts with letter/underscore/dollar, contains only alphanumeric/underscore/dollar)
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
}

// Helper function to sanitize function names for TypeScript
export function sanitizeFunctionName(name) {
  if (!name || typeof name !== 'string') return 'unknownFunction';
  
  // Handle names that start with numbers
  if (/^\d/.test(name)) {
    name = '_' + name;
  }
  
  // Replace invalid characters with underscores
  name = name.replace(/[^a-zA-Z0-9_$]/g, '_');
  
  // If it's a reserved keyword, prefix with underscore
  if (isReservedKeyword(name)) {
    name = '_' + name;
  }
  
  return name;
}

export function generateTypeDefinitions(data) {

  const organized = organizeData(data);

  return {
    p5Types: generateP5TypeDefinitions(organized, data),
    globalTypes: generateGlobalTypeDefinitions(organized),
    fileTypes: generateFileTypeDefinitions(organized, data)
  };
}
function generateP5TypeDefinitions(organizedData, data) {
    let output = '// This file is auto-generated from JSDoc documentation\n\n';

    output += `declare class p5 {\n`;
    output += `  constructor(sketch?: (p: p5) => void, node?: HTMLElement, sync?: boolean);\n\n`;
    const instanceItems = organizedData.classitems.filter(item =>
      item.class === 'p5' && !item.isStatic
    );
    instanceItems.forEach(item => {
      output += generateMethodDeclarations(item, false);
    });

    const staticItems = organizedData.classitems.filter(item =>
      item.class === 'p5' && item.isStatic
    );
    staticItems.forEach(item => {
      output += generateMethodDeclarations(item, true);
    });

    Object.values(organizedData.consts).forEach(constData => {
      if (constData.class === 'p5') {
        if (constData.description) {
          output += `  /**\n   * ${constData.description}\n   */\n`;
        }
        if (constData.kind === 'constant') {
          output += `  readonly ${constData.name.toUpperCase()}: ${constData.type};\n\n`;
        } else if (constData.kind === 'typedef') {
          // For typedef constants, create both instance and static versions
          output += `  readonly ${constData.name}: ${constData.type};\n`;
          output += `  static readonly ${constData.name}: ${constData.type};\n\n`;
        } else {
          output += `  static ${constData.name}: ${constData.type};\n\n`;
        }
      }
    });

    output += `}\n\n`;

    output += `declare namespace p5 {\n`;

    Object.values(organizedData.consts).forEach(constData => {
      if (constData.kind === 'typedef') {
        if (constData.description) {
          output += `  /**\n   * ${constData.description}\n   */\n`;
        }
        output += `  type ${constData.name} = ${constData.type};\n\n`;
      }
    });

    // Get classes that have dedicated files 
    const classesWithDedicatedFiles = getClassesWithDedicatedFiles(organizedData, data);
    
    Object.values(organizedData.classes).forEach(classDoc => {
      if (classDoc.name !== 'p5' && 
          !classDoc.name.includes('ErrorStackParser') &&
          !classesWithDedicatedFiles.has(classDoc.name) &&
          !classesWithDedicatedFiles.has(`p5.${classDoc.name}`) &&
          !classesWithDedicatedFiles.has(classDoc.name.replace('p5.', ''))) {
        output += generateClassDeclaration(classDoc, organizedData);
      }
    });

    // Add type aliases for classes with dedicated files so they're accessible via p5.ClassName
    const addedClasses = new Set();
    classesWithDedicatedFiles.forEach(className => {
      const cleanClassName = className.replace('p5.', '');
      if (!addedClasses.has(cleanClassName)) {
        // Use type alias to reference the actual class from the module augmentation
        output += `  type ${cleanClassName} = import('p5').${cleanClassName};\n`;
        addedClasses.add(cleanClassName);
      }
    });

    output += `}\n\n`;

    output += `export default p5;\n`;
    output += `export as namespace p5;\n`;

    return output;
  }

function generateGlobalTypeDefinitions(organizedData) {
    let output = '// This file is auto-generated from JSDoc documentation\n\n';
    output += `import p5 from 'p5';\n\n`;
    output += `declare global {\n`;

    const instanceItems = organizedData.classitems.filter(item =>
      item.class === 'p5' && !item.isStatic
    );
    instanceItems.forEach(item => {
      if (item.kind === 'function') {
        if (item.description) {
          output += `  /**\n${formatJSDocComment(item.description, 2)}\n   */\n`;
        }

        if (item.overloads?.length > 0) {
          item.overloads.forEach(overload => {
            const params = (overload.params || [])
              .map(param => generateParamDeclaration(param))
              .join(', ');
            const returnType = overload.returns?.[0]?.type
              ? generateTypeFromTag(overload.returns[0])
              : 'void';
            output += `  function ${item.name}(${params}): ${returnType};\n`;
          });
        }

        const params = (item.params || [])
          .map(param => generateParamDeclaration(param))
          .join(', ');
        output += `  function ${item.name}(${params}): ${item.returnType};\n\n`;
      } else if (item.kind === 'property') {
        if (item.description) {
          output += `  /**\n${formatJSDocComment(item.description, 2)}\n   */\n`;
        }
        output += `  const ${item.name}: ${item.returnType};\n\n`;
      }
    });

    Object.values(organizedData.consts).forEach(constData => {
      if (constData.kind === 'constant') {
        if (constData.description) {
          output += `  /**\n${formatJSDocComment(constData.description, 2)}\n   */\n`;
       }
        output += `  const ${constData.name.toUpperCase()}: p5.${constData.name.toUpperCase()};\n\n`;
      } else if (constData.kind === 'typedef') {
        if (constData.description) {
          output += `  /**\n${formatJSDocComment(constData.description, 2)}\n   */\n`;
        }
        output += `  const ${constData.name}: ${constData.type};\n\n`;
      }
    });

    output += `  interface Window {\n`;

    instanceItems.forEach(item => {
      if (item.kind === 'function') {
        output += `    ${item.name}: typeof ${item.name};\n`;
      } else if (item.kind === 'property') {
        output += `    readonly ${item.name}: typeof ${item.name};\n`;
      }
    });

    Object.values(organizedData.consts).forEach(constData => {
      if (constData.kind === 'constant') {
        if (constData.description) {
          output += `    /**\n     * ${constData.description}\n     */\n`;
        }
        output += `    readonly ${constData.name.toUpperCase()}: typeof ${constData.name.toUpperCase()};\n`;
      } else if (constData.kind === 'typedef') {
        if (constData.description) {
          output += `    /**\n     * ${constData.description}\n     */\n`;
        }
        output += `    readonly ${constData.name}: typeof ${constData.name};\n`;
      }
    });

    output += `  }\n`;
    output += `}\n\n`;
    output += `export {};\n`;

    return output;
  }

function generateFileTypeDefinitions(organizedData, data) {
    const fileDefinitions = new Map();
    const fileGroups = groupByFile(getAllEntries(data));

    fileGroups.forEach((items, filePath) => {
      const declarationContent = generateDeclarationFile(items, organizedData);
      fileDefinitions.set(filePath, declarationContent);
    });

    return fileDefinitions;
  }

  // Helper function to get classes that have dedicated files
  function getClassesWithDedicatedFiles(organizedData, data) {
    const fileGroups = groupByFile(getAllEntries(data));
    const classesWithFiles = new Set();
    
    fileGroups.forEach((items, filePath) => {
      const classDoc = items.find(item => item.kind === 'class');
      if (classDoc) {
        // Add both the original class name and the normalized version
        classesWithFiles.add(classDoc.name);
        classesWithFiles.add(normalizeClassName(classDoc.name));
        // Also add without p5. prefix for matching
        const withoutPrefix = classDoc.name.replace('p5.', '');
        classesWithFiles.add(withoutPrefix);
      }
    });
    
    return classesWithFiles;
  }
  const organized = {
    modules: {},
    classes: {},
    classitems: [],
    consts: {}
  };

function generateDeclarationFile(items, organizedData) {
    let output = '// This file is auto-generated from JSDoc documentation\n\n';
    const imports = new Set([`import p5 from 'p5';`]);
    
    // Get the class being defined in this file to avoid self-imports
    const classDoc = items.find(item => item.kind === 'class');
    const currentClassName = classDoc ? normalizeClassName(classDoc.name).replace('p5.', '') : '';
    
    const hasColorDependency = items.some(item => {
      const typeName = item.type?.name;
      const desc = extractDescription(item.description);
      return (typeName === 'Color' || (typeof desc === 'string' && desc.includes('Color'))) 
             && currentClassName !== 'Color'; // Don't import Color in Color's own file
    });

    const hasVectorDependency = items.some(item => {
      const typeName = item.type?.name;
      const desc = extractDescription(item.description);
      return (typeName === 'Vector' || (typeof desc === 'string' && desc.includes('Vector'))) 
             && currentClassName !== 'Vector'; // Don't import Vector in Vector's own file
    });

    const hasConstantsDependency = items.some(item =>
      item.tags?.some(tag => tag.title === 'requires' && tag.description === 'constants')
    );

    if (hasColorDependency) {
      imports.add(`import { Color } from '../color/p5.Color';`);
    }
    if (hasVectorDependency) {
      imports.add(`import { Vector } from '../math/p5.Vector';`);
    }
    if (hasConstantsDependency) {
      imports.add(`import * as constants from '../core/constants';`);
    }

    output += Array.from(imports).join('\n') + '\n\n';
    
    if (classDoc) {
      const fullClassName = normalizeClassName(classDoc.name);
      const classDocName = fullClassName.replace('p5.', '');
      let parentClass = classDoc.tags?.find(tag => tag.title === 'extends')?.name;
      if (parentClass) {
        parentClass = parentClass.replace('p5.', '');
      }
      const extendsClause = parentClass ? ` extends ${parentClass}` : '';

      // First, add the class to the p5 namespace for p5.ClassName access
      output += `declare namespace p5 {\n`;
      output += `  class ${classDocName}${extendsClause} {\n`;

      if (classDoc.params?.length > 0) {
        output += '    constructor(';
        output += classDoc.params
          .map(param => generateParamDeclaration(param))
          .join(', ');
        output += ');\n\n';
      }

      const classItems = organizedData.classitems.filter(item =>
        item.class === fullClassName ||
        item.class === fullClassName.replace('p5.', '')
      );

      const staticItems = classItems.filter(item => item.isStatic);
      const instanceItems = classItems.filter(item => !item.isStatic);
      staticItems.forEach(item => {
        output += generateMethodDeclarations(item, true);
      });
      instanceItems.forEach(item => {
        output += generateMethodDeclarations(item, false);
      });
      output += '  }\n'; // Close the class
      output += '}\n\n'; // Close the namespace

      // Also add the module augmentation for extending the p5 module itself
      output += `declare module 'p5' {\n`;
      output += `  class ${classDocName}${extendsClause} {\n`;

      if (classDoc.params?.length > 0) {
        output += '    constructor(';
        output += classDoc.params
          .map(param => generateParamDeclaration(param))
          .join(', ');
        output += ');\n\n';
      }

      staticItems.forEach(item => {
        output += generateMethodDeclarations(item, true);
      });
      instanceItems.forEach(item => {
        output += generateMethodDeclarations(item, false);
      });
      output += '  }\n'; // Close the class
      output += '}\n\n'; // Close the module
    }

    // Handle non-class items (functions, constants, etc.)
    const nonClassItems = items.filter(item => 
      item.kind !== 'class' && (!item.memberof || item.memberof !== classDoc?.name)
    );

    if (nonClassItems.length > 0) {
      output += `declare module 'p5' {\n`;
      nonClassItems.forEach(item => {
        switch (item.kind) {
          case 'function':
            output += generateFunctionDeclaration(item);
            break;
          case 'constant':
          case 'typedef':
            const constData = organizedData.consts[item.name];
            if (constData) {
              if (constData.description) {
                output += `  /**\n   * ${constData.description}\n   */\n`;
              }
              if (constData.kind === 'constant') {
                output += `  const ${constData.name}: ${constData.type};\n\n`;
              } else {
                output += `  type ${constData.name} = ${constData.type};\n\n`;
              }
            }
            break;
        }
      });
      output += '}\n\n';
    }

    return output;
  }

  export function organizeData(data) {
    const allData = getAllEntries(data);

    organized.modules = {};
    organized.classes = {};
    organized.classitems = [];
    organized.consts = {};

    allData.forEach(entry => {
      const { module, submodule, forEntry } = getModuleInfo(entry);
      
      // Handle special case where memberof is 'fn' - this should be treated as p5
      let classTarget = forEntry || entry.memberof || 'p5';
      if (classTarget === 'fn') {
        classTarget = 'p5';
      }
      const className = normalizeClassName(classTarget);

      // Check tags to determine the actual kind for entries with null kind
      const propertyTag = entry.tags?.find(tag => tag.title === 'property');
      const typedefTag = entry.tags?.find(tag => tag.title === 'typedef');
      const constantTag = entry.tags?.find(tag => tag.title === 'constant');
      
      // Handle Object.defineProperty entries that contain properties in their properties array
      if (entry.name === 'defineProperty' && entry.properties?.length > 0) {
        entry.properties.forEach(prop => {
          organized.classitems.push({
            name: prop.name,
            kind: 'property',
            description: extractDescription(entry.description),
            params: [],
            returnType: generateTypeFromTag(prop),
            module,
            submodule,
            class: className,
            isStatic: false,
            overloads: undefined
          });
        });
        return; // Skip further processing of this entry
      }
      
      // Determine effective kind
      let effectiveKind = entry.kind;
      if (!effectiveKind) {
        if (propertyTag) {
          effectiveKind = 'property';
        } else if (typedefTag) {
          effectiveKind = 'typedef';
        } else if (constantTag) {
          effectiveKind = 'constant';
        }
      }

      switch(effectiveKind) {
        case 'class':
          // For classes, use the actual entry name as the key, not the normalized className
          const classKey = entry.name.startsWith('p5.') ? entry.name : normalizeClassName(entry.name);
          organized.classes[classKey] = {
            name: entry.name,
            description: extractDescription(entry.description),
            params: (entry.params || []).map(param => ({
              name: param.name,
              type: generateTypeFromTag(param),
              optional: param.type?.type === 'OptionalType',
              rest: param.type?.type === 'RestType'
            })),
            module,
            submodule,
            extends: entry.tags?.find(tag => tag.title === 'extends')?.name || null
          }; break;
          case 'function':
          case 'property':
            const overloads = entry.overloads?.map(overload => ({
              params: overload.params,
              returns: overload.returns,
              description: extractDescription(overload.description)
            }));

            // For properties with property tags, get the type from the tag
            let returnType = 'void';
            if (effectiveKind === 'property' && propertyTag?.type) {
              returnType = generateTypeFromTag(propertyTag);
            } else if (entry.tags?.find(tag => tag.title === "chainable")) {
              returnType = "this";
            } else if (entry.returns?.[0]) {
              returnType = generateTypeFromTag(entry.returns[0]);
            }

            organized.classitems.push({
              name: entry.name,
              kind: effectiveKind,
              description: extractDescription(entry.description),
              params: (entry.params || []).map(param => ({
                name: param.name,
                type: generateTypeFromTag(param),
                optional: param.type?.type === 'OptionalType',
                rest: param.type?.type === 'RestType'
              })),
              returnType,
              module,
              submodule,
              class: className,
              // For p5 instance properties documented as static, treat them as instance properties
              isStatic: className === 'p5' && effectiveKind === 'property' ? false : entry.path?.[0]?.scope === 'static',
              overloads
            }); break;
          case 'constant':
          case 'typedef':
            // For typedef entries, get the type from the typedef tag if available
            let constType = 'any';
            if (effectiveKind === 'typedef' && typedefTag?.type) {
              constType = generateTypeFromTag(typedefTag);
            } else if (effectiveKind === 'constant') {
              constType = `P5.${entry.name.toUpperCase()}`;
            } else if (entry.type) {
              constType = generateTypeFromTag(entry);
            }

            organized.consts[entry.name] = {
              name: entry.name,
              kind: effectiveKind,
              description: extractDescription(entry.description),
              type: constType,
              module,
              submodule,
              class: forEntry || 'p5'
            }; break;
        }
      });
    return organized;
  }

  export function getModuleInfo(entry) {
    return {
        module: entry.tags?.find(tag => tag.title === 'module')?.name || 'p5',
        submodule: entry.tags?.find(tag => tag.title === 'submodule')?.description || null,
        forEntry: entry.tags?.find(tag => tag.title === 'for')?.description || entry.memberof
    };
}
export function extractDescription(desc) {
    if (!desc) return '';
    if (typeof desc === 'string') return desc;
    if (desc.children) {
      return desc.children.map(child => {
          if (child.type === 'text') return child.value;
          if (child.type === 'paragraph') return extractDescription(child);
          if (child.type === 'inlineCode' || child.type === 'code') return `\`${child.value}\``;
          return '';
        })
        .join('').trim().replace(/\n{3,}/g, '\n\n');
    }
    return '';
  }
export function generateTypeFromTag(param) {
    if (!param || !param.type) return 'any';

    switch (param.type.type) {
      case 'NameExpression':
        return normalizeTypeName(param.type.name);
      case 'TypeApplication': {
        const baseType = normalizeTypeName(param.type.expression.name);

        if (baseType === 'Array') {
          const innerType = param.type.applications[0];
          const innerTypeStr = generateTypeFromTag({ type: innerType });
          return `${innerTypeStr}[]`;
        }

        const typeParams = param.type.applications
          .map(app => generateTypeFromTag({ type: app }))
          .join(', ');
        return `${baseType}<${typeParams}>`;
      }
      case 'UnionType':
        const unionTypes = param.type.elements
          .map(el => generateTypeFromTag({ type: el }))
          .join(' | ');
        return unionTypes;
      case 'OptionalType':
        return generateTypeFromTag({ type: param.type.expression });
      case 'AllLiteral':
        return 'any';
      case 'RecordType':
        return 'object';
      case 'StringLiteralType':
        return `'${param.type.value}'`;
      case 'UndefinedLiteralType':
        return 'undefined';
      case 'ArrayType': {
        const innerTypeStrs = param.type.elements.map(e => generateTypeFromTag({ type: e }));
        return `[${innerTypeStrs.join(', ')}]`;
      }
      case 'RestType':
        return `${generateTypeFromTag({ type: param.type.expression })}[]`;
      default:
        return 'any';
    }
  }

  export function normalizeTypeName(type) {
    if (!type) return 'any';

    if (type === '[object Object]') return 'any';

    const primitiveTypes = {
      'String': 'string',
      'Number': 'number',
      'Integer': 'number',
      'Boolean': 'boolean',
      'Void': 'void',
      'Object': 'object',
      'Array': 'Array',
      'Function': 'Function'
    };

    return primitiveTypes[type] || type;
  }

  export function generateParamDeclaration(param) {
    if (!param) return 'any';

    let type = param.type;
    let prefix = '';
    const isOptional = param.optional || param.type?.type === 'OptionalType';
    if (typeof type === 'string') {
      type = normalizeTypeName(type);
    } else if (param.type?.type) {
      type = generateTypeFromTag(param);
    } else {
      type = 'any';
    }

    if (param.rest || param.type?.type === 'RestType') {
      prefix = '...';
    }

    // Escape reserved keywords and invalid identifiers
    let paramName = param.name;
    if (isReservedKeyword(paramName) || !isValidIdentifier(paramName)) {
      paramName = `_${paramName}`;
    }

    return `${prefix}${paramName}${isOptional ? '?' : ''}: ${type}`;
  }

  export function generateFunctionDeclaration(funcDoc) {

    let output = '';

    if (funcDoc.description || funcDoc.tags?.length > 0) {
      output += '/**\n';
      const description = extractDescription(funcDoc.description);
      if (description) {
        output += formatJSDocComment(description) + '\n';
      }
      if (funcDoc.tags) {
        if (description) {
          output += ' *\n';
        }
        funcDoc.tags.forEach(tag => {
          if (tag.description) {
            const tagDesc = extractDescription(tag.description);
            output += formatJSDocComment(`@${tag.title} ${tagDesc}`, 0) + '\n';
          }
        });
      }
      output += ' */\n';
    }

    const params = (funcDoc.params || [])
      .map(param => generateParamDeclaration(param))
      .join(', ');

    const returnType = funcDoc.returns?.[0]?.type
      ? generateTypeFromTag(funcDoc.returns[0])
      : 'void';

    const sanitizedName = sanitizeFunctionName(funcDoc.name);
    
    // Special handling for p5 constructor and malformed function declarations
    if (funcDoc.name === 'p5' || (returnType && returnType.includes('typeof'))) {
      return ''; // Skip malformed declarations
    }
    
    output += `function ${sanitizedName}(${params}): ${returnType};\n\n`;
    return output;
  }

  export function generateMethodDeclarations(item, isStatic = false, isGlobal = false) {
    let output = '';

    if (item.description) {
      output += '  /**\n';
      const itemDesc = extractDescription(item.description);
      output += formatJSDocComment(itemDesc, 2) + '\n';
      if (item.params?.length > 0) {
        output += ' *\n';
        item.params.forEach(param => {
          const paramDesc = extractDescription(param.description);
          output += formatJSDocComment(`@param ${paramDesc}`, 2) + '\n';
        });
      }
      if (item.returns) {
        output += ' *\n';
        const returnDesc = extractDescription(item.returns[0]?.description);
        output += formatJSDocComment(`@return ${returnDesc}`, 2) + '\n';
      }
      output += '   */\n';
    }

    if (item.kind === 'function') {
      const staticPrefix = isStatic ? 'static ' : '';

      if (item.overloads?.length > 0) {
        const sanitizedMethodName = sanitizeFunctionName(item.name);
        item.overloads.forEach(overload => {
          const params = (overload.params || [])
            .map(param => generateParamDeclaration(param))
            .join(', ');
          const returnType = overload.returns?.[0]?.type
            ? generateTypeFromTag(overload.returns[0])
            : 'void';
          output += `  ${staticPrefix}${sanitizedMethodName}(${params}): ${returnType};\n`;
        });
      }

      const params = (item.params || [])
        .map(param => generateParamDeclaration(param))
        .join(', ');
      const sanitizedMethodName = sanitizeFunctionName(item.name);
      output += `  ${staticPrefix}${sanitizedMethodName}(${params}): ${item.returnType};\n\n`;
    } else {
      const staticPrefix = isStatic ? 'static ' : '';
      const sanitizedPropertyName = sanitizeFunctionName(item.name);
      output += `  ${staticPrefix}${sanitizedPropertyName}: ${item.returnType};\n\n`;
    }

    return output;
  }

export function generateClassDeclaration(classDoc, organizedData) {


    let output = '';

    if (classDoc.description || classDoc.tags?.length > 0) {
      output += '/**\n';
      const description = extractDescription(classDoc.description);
      if (description) {
        output += formatJSDocComment(description) + '\n';
      }
      if (classDoc.tags) {
        if (description) {
          output += ' *\n';
        }
        classDoc.tags.forEach(tag => {
          if (tag.description) {
            const tagDesc = extractDescription(tag.description);
            output += formatJSDocComment(`@${tag.title} ${tagDesc}`, 0) + '\n';
          }
        });
      }
      output += ' */\n';
    }

    const parentClass = classDoc.extends;
    const extendsClause = parentClass ? ` extends ${parentClass}` : '';

    const fullClassName = normalizeClassName(classDoc.name);
    const classDocName = fullClassName.replace('p5.', '');
    output += `class ${classDocName}${extendsClause} {\n`;

    if (classDoc.params?.length > 0) {
      output += '  constructor(';
      output += classDoc.params
        .map(param => generateParamDeclaration(param))
        .join(', ');
      output += ');\n\n';
    }

    const classItems = organizedData.classitems.filter(item =>
      item.class === fullClassName ||
      item.class === fullClassName.replace('p5.', '')
    );
    const staticItems = classItems.filter(item => item.isStatic);
    const instanceItems = classItems.filter(item => !item.isStatic);

    staticItems.forEach(item => {
      output += generateMethodDeclarations(item, true);
    });

    instanceItems.forEach(item => {
      output += generateMethodDeclarations(item, false);
    });

    output += '}\n\n';
    return output;
  }

function formatJSDocComment(text, indentLevel = 0) {
    if (!text) return '';
    const indent = ' '.repeat(indentLevel);

    const lines = text
      .split('\n')
      .map(line => line.trim())
      .reduce((acc, line) => {
        // If we're starting and line is empty, skip it
        if (acc.length === 0 && line === '') return acc;
        // If we have content and hit an empty line, keep one empty line
        if (acc.length > 0 && line === '' && acc[acc.length - 1] === '') return acc;
        acc.push(line);
        return acc;
      }, [])
      .filter((line, i, arr) => i < arr.length - 1 || line !== ''); // Remove trailing empty line

    return lines
      .map(line => `${indent} * ${line}`)
      .join('\n');
  }
  function groupByFile(items) {
    const fileGroups = new Map();

    items.forEach(item => {
      if (!item.context || !item.context.file) return;

      const filePath = item.context.file;
      if (!fileGroups.has(filePath)) {
        fileGroups.set(filePath, []);
      }
      fileGroups.get(filePath).push(item);
    });

    return fileGroups;
  }
