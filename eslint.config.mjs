import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // DB 레이어 캡슐화: 외부 코드는 반드시 공개 배럴(@/lib/db)만 사용.
  // deep import (@/lib/db/factory, @/lib/db/providers/*, @/lib/db/secret 등) 와
  // oracledb 직접 사용은 모두 차단한다. 정적·동적 import 모두 해당.
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/db/*"],
              message:
                "lib/db 의 deep import 는 금지입니다. 공개 배럴 '@/lib/db' 만 사용하세요.",
            },
            {
              // 신규 DB 드라이버 도입 시 이 배열에만 추가하면 된다.
              // 예: 'pg', 'mariadb', 'mysql2', 'mssql', 'tedious'
              group: ["oracledb"],
              message:
                "DB 네이티브 드라이버를 직접 import 하지 마세요. '@/lib/db' 의 getDb() 를 사용하세요.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportExpression[source.value=/^@\\/lib\\/db\\//]",
          message:
            "lib/db 의 dynamic import 는 금지입니다. 공개 배럴 '@/lib/db' 만 사용하세요.",
        },
        {
          // 신규 DB 드라이버 도입 시 이 배열에도 동일하게 추가한다.
          // ex) selector: "ImportExpression[source.value=/^(oracledb|pg|mariadb|mysql2|mssql|tedious)$/]"
          selector: "ImportExpression[source.value='oracledb']",
          message:
            "DB 네이티브 드라이버를 직접 dynamic import 하지 마세요. '@/lib/db' 의 getDb() 를 사용하세요.",
        },
      ],
    },
  },
  // lib/db 내부 파일들은 자기 자신의 모듈을 자유롭게 import 해야 하므로 규칙 해제.
  {
    files: ["lib/db/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-syntax": "off",
    },
  },
  // 서버 부팅 훅은 warmupDb 호출을 위해 @/lib/db/factory 를 dynamic import 한다.
  // (warmupDb 는 부팅 전용이라 공개 배럴에서 의도적으로 제외됨)
  // no-restricted-imports(정적) 는 유지하고, dynamic import 차단 규칙만 면제한다.
  {
    files: ["instrumentation-node.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
]);

export default eslintConfig;
