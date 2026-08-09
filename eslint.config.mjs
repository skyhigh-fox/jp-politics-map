import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "data/**",
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      // サブエージェント用のネストしたgit worktree（.gitignore済みだが、
      // ESLintのファイル探索はgitignoreを見ないネスト先までは辿らないため明示的に除外）
      ".claude/**",
    ],
  },
];

export default eslintConfig;
