import { TextlintKernel } from "@textlint/kernel";

export type ProofreadIssue = {
  line: number;
  column: number;
  message: string;
  ruleId: string;
  severity: "error" | "warning";
};

// CJS モジュールは require でリテラル文字列指定（Webpack の静的解析のため）
/* eslint-disable @typescript-eslint/no-require-imports */
const TextPlugin          = require("@textlint/textlint-plugin-text");
const ruleJaNoMixedPeriod = require("textlint-rule-ja-no-mixed-period");
const ruleJaNoRedundant   = require("textlint-rule-ja-no-redundant-expression");
const ruleNoNfd           = require("textlint-rule-no-nfd");
/* eslint-enable @typescript-eslint/no-require-imports */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unwrap = (m: any) => m?.default ?? m;

const kernel = new TextlintKernel();

const PLUGINS = [{ pluginId: "text", plugin: unwrap(TextPlugin) }];

const RULES = [
  { ruleId: "ja-no-mixed-period",         rule: unwrap(ruleJaNoMixedPeriod) },
  { ruleId: "ja-no-redundant-expression", rule: unwrap(ruleJaNoRedundant)   },
  { ruleId: "no-nfd",                     rule: unwrap(ruleNoNfd)            },
];

export async function runProofread(
  text: string,
): Promise<{ issues: ProofreadIssue[]; error?: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { issues: [] };

  try {
    const result = await kernel.lintText(trimmed, {
      filePath: "text.txt",
      ext: ".txt",
      plugins: PLUGINS,
      rules: RULES,
      filterRules: [],
    });

    return {
      issues: result.messages.map((m) => ({
        line: m.line,
        column: m.column,
        message: m.message.split("\n")[0],
        ruleId: m.ruleId ?? "unknown",
        severity: m.severity === 2 ? "error" : "warning",
      })),
    };
  } catch (e) {
    return { issues: [], error: e instanceof Error ? e.message : String(e) };
  }
}
