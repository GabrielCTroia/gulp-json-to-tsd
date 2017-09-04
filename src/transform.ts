
import * as path from "path";
import { Options } from "./options";
import { TsdBuilder } from "./tsd-builder";
import * as _ from 'lodash';

function isLatinLetter(char: string) {
    return char >= "a" && char <= "z"
        || char >= "A" && char <= "Z";
}

function isDigit(char: string) {
    return char >= "0" && char <= "9";
}

function getCamelCase(originalName: string, startFromUpperCase: boolean, allowFirstDigit: boolean): string {
    let result = "";
    let upperCase = startFromUpperCase;
    for (const char of originalName) {
        if (isDigit(char)) {
            if (result.length === 0 && !allowFirstDigit) {
                result = "_";
            }
            result = result + char;
            upperCase = false;
            continue;
        }
        if (isLatinLetter(char)) {
            if (upperCase) {
                result = result + char.toUpperCase();
            } else {
                result = result + char;
            }
            upperCase = false;
            continue;
        }
        upperCase = true;
    }
    return result;
}

function getInterfaceName(fileName: string, options: Options): string {
    const useInterfacePrefix = options.useInterfacePrefix || false;
    const result = (useInterfacePrefix ? "I" : "") + getCamelCase(fileName, true, useInterfacePrefix);
    return result;
}

function getVariableName(fileName: string): string {
    const result = getCamelCase(fileName, false /*startFromUpperCase*/, false /*allowFirstDigit*/);
    return result;
}

type PrimitiveTypes = 'null|undefined' | 'number' | 'string' | 'boolean';

function getType(value: any, currentIndentation): PrimitiveTypes | string {
    if (value == null) {
        return "null|undefined";
    } else if (typeof value === "number") {
        return "number";
    } else if (typeof value === "string") {
        return "string";
    } else if (typeof value === "boolean") {
        return "boolean";
    } else if (_.isArray(value)) {
        const allElementTypes = _.map(_.values(value), getType);
        const uniqElementTypes = _.uniq(allElementTypes);
        
        // TODO: Add option to throw error when strict no any is enforced
        const commonElementType = uniqElementTypes.length === 1 ? uniqElementTypes[0] : 'any';

        return `${commonElementType}[]`;
    } else if (typeof value === "object") {
        const nestedBuilder = new TsdBuilder('', "tab", 2)

        transformObject(value, nestedBuilder);

        return `{ ${nestedBuilder.toString()} }`;
    }

    return 'any';
}

function transformObject(json: any, builder: TsdBuilder) {
    for (let key in json) {
        if (!json.hasOwnProperty(key)) continue;
        builder.property(key, getType(json[key], builder.getCurrentIndentation()))
    }
}

export function transform(file: any, json: any, encoding: string, options: Options): any {
    const builder = new TsdBuilder(encoding, options.identStyle || "tab", options.identSize || 1);
    const fullFileName = path.parse(file.path);
    const interfaceName = getInterfaceName(fullFileName.name, options);

    if (options.namespace) {
        builder.beginNamespace(options.namespace, true /*declared*/);
    }
    builder.beginInterface(interfaceName, !options.namespace /*declared*/);
    transformObject(json, builder);
    builder.end();
    if (options.namespace) {
        builder.end();
    }
    if (options.declareVariable) {
        const variableName = getVariableName(fullFileName.name);
        builder.declareConstant(
            variableName, 
            options.namespace ? `${options.namespace}.${interfaceName}` : interfaceName);
    }
    file.path = path.join(fullFileName.dir, `${fullFileName.name}.d.ts`);
    file.contents = builder.toBuffer();

    return file;
}