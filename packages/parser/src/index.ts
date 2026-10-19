import bundled from '../generated/templates.json';
import {CompiledTemplate, compileTemplates} from './parse';
import {TemplateSource} from './types';

export * from './types';
export {toPaise, parseDate} from './values';
export {merchantKey, cleanMerchant} from './merchant';
export {parseSms, compileTemplates, senderCode, allSenderCodes} from './parse';
export type {CompiledTemplate} from './parse';
export {dedupe, isDuplicate} from './dedupe';
export * from './analyze';

let compiled: CompiledTemplate[] | null = null;

// Templates bundled from parsers/*.yaml at build time, compiled once.
export function bundledTemplates(): CompiledTemplate[] {
  compiled ??= compileTemplates(bundled as TemplateSource[]);
  return compiled;
}
