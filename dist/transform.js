"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var path = require("path");
var tsd_builder_1 = require("./tsd-builder");
var _ = require("lodash");
function isLatinLetter(char) {
    return char >= "a" && char <= "z"
        || char >= "A" && char <= "Z";
}
function isDigit(char) {
    return char >= "0" && char <= "9";
}
function getCamelCase(originalName, startFromUpperCase, allowFirstDigit) {
    var result = "";
    var upperCase = startFromUpperCase;
    for (var _i = 0, originalName_1 = originalName; _i < originalName_1.length; _i++) {
        var char = originalName_1[_i];
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
            }
            else {
                result = result + char;
            }
            upperCase = false;
            continue;
        }
        upperCase = true;
    }
    return result;
}
function getInterfaceName(fileName, options) {
    var useInterfacePrefix = options.useInterfacePrefix || false;
    var result = (useInterfacePrefix ? "I" : "") + getCamelCase(fileName, true, useInterfacePrefix);
    return result;
}
function getVariableName(fileName) {
    var result = getCamelCase(fileName, false, false);
    return result;
}
function getType(value, currentIndentation) {
    if (value == null) {
        return "null|undefined";
    }
    else if (typeof value === "number") {
        return "number";
    }
    else if (typeof value === "string") {
        return "string";
    }
    else if (typeof value === "boolean") {
        return "boolean";
    }
    else if (_.isArray(value)) {
        var allElementTypes = _.map(_.values(value), getType);
        var uniqElementTypes = _.uniq(allElementTypes);
        var commonElementType = uniqElementTypes.length === 1 ? uniqElementTypes[0] : 'any';
        return commonElementType + "[]";
    }
    else if (typeof value === "object") {
        var nestedBuilder = new tsd_builder_1.TsdBuilder('', "tab", 2);
        transformObject(value, nestedBuilder);
        return "{ " + nestedBuilder.toString() + " }";
    }
    return 'any';
}
function transformObject(json, builder) {
    for (var key in json) {
        if (!json.hasOwnProperty(key))
            continue;
        builder.property(key, getType(json[key], builder.getCurrentIndentation()));
    }
}
function transform(file, json, encoding, options) {
    var builder = new tsd_builder_1.TsdBuilder(encoding, options.identStyle || "tab", options.identSize || 1);
    var fullFileName = path.parse(file.path);
    var interfaceName = getInterfaceName(fullFileName.name, options);
    if (options.namespace) {
        builder.beginNamespace(options.namespace, true);
    }
    builder.beginInterface(interfaceName, !options.namespace);
    transformObject(json, builder);
    builder.end();
    if (options.namespace) {
        builder.end();
    }
    if (options.declareVariable) {
        var variableName = getVariableName(fullFileName.name);
        builder.declareConstant(variableName, options.namespace ? options.namespace + "." + interfaceName : interfaceName);
    }
    file.path = path.join(fullFileName.dir, fullFileName.name + ".d.ts");
    file.contents = builder.toBuffer();
    return file;
}
exports.transform = transform;
