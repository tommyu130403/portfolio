import { NextRequest, NextResponse } from "next/server";
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
const TextPlugin           = require("@textlint/textlint-plugin-text");
const ruleJaNoAbusage      = require("textlint-rule-ja-no-abusage");
const ruleJaNoMixedPeriod  = require("textlint-rule-ja-no-mixed-period");
const ruleNoDoubledJoshi   = require("textlint-rule-no-doubled-joshi");
const ruleJaNoRedundant    = require("textlint-rule-ja-no-redundant-expression");
const ruleNoNfd            = require("textlint-rule-no-nfd");
/* eslint-enable @typescript-eslint/no-require-imports */

// CJS の module.exports が { default: ... } 形式でも直接オブジェクトでも対応
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unwrap = (m: any) => m?.default ?? m;

const kernel = new TextlintKernel();

const PLUGINS = [
  { pluginId: "text", plugin: unwrap(TextPlugin) },
];

const RULES = [
  { ruleId: "ja-no-abusage",             rule: unwrap(ruleJaNoAbusage)     },
  { ruleId: "ja-no-mixed-period",        rule: unwrap(ruleJaNoMixedPeriod) },
  { ruleId: "no-doubled-joshi",          rule: unwrap(ruleNoDoubledJoshi)  },
  { ruleId: "ja-no-redundant-expression",rule: unwrap(ruleJaNoRedundant)   },
  { ruleId: "no-nfd",                    rule: unwrap(ruleNoNfd)           },
];

export async function POST(req: NextRequest) {
  let text: string;
  try {
    ({ text } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ issues: [] });
  }

  try {
    const result = await kernel.lintText(text, {
      filePath: "text.txt",
      ext: ".txt",
      plugins: PLUGINS,
      rules: RULES,
      filterRules: [],
    });

    const issues: ProofreadIssue[] = result.messages.map((m) => ({
      line: m.line,
      column: m.column,
      // メッセージが複数行の場合は最初の1行だけ表示
      message: m.message.split("\n")[0],
      ruleId: m.ruleId ?? "unknown",
      severity: m.severity === 2 ? "error" : "warning",
    }));

    return NextResponse.json({ issues });
  } catch (err) {
    console.error("[proofread] textlint error:", err);
    return NextResponse.json({ error: String(err), issues: [] }, { status: 500 });
  }
}
