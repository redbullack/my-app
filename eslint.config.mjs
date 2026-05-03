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
  // ────────────────────────────────────────────────────────────────
  // Promise / await 누락 방지 (전역 적용)
  //
  // 주된 동기는 ServerAction 에서 getDb().query/execute/tx 의 await 누락을 막는 것이지만,
  // 동일한 실수는 fetch/fs/외부 API 호출 등 모든 비동기 코드에서 똑같이 위험하므로 전역으로 켠다.
  // 의도적으로 fire-and-forget 하고 싶다면 `void asyncFn()` 또는 `.catch(noop)` 으로 명시한다.
  //
  // 타입 기반 룰이므로 parserOptions.projectService 를 직접 켜야 한다.
  // (eslint-config-next/typescript 는 이 옵션을 켜주지 않는다 — 켜지 않으면
  //  no-floating-promises 등이 "rule requires type information" 에러로 로드 실패한다.)
  // ────────────────────────────────────────────────────────────────
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // 처리되지 않은 Promise (await/void/then/catch 모두 없는 경우) 차단.
      "@typescript-eslint/no-floating-promises": [
        "error",
        { ignoreVoid: true, ignoreIIFE: true },
      ],
      // forEach(async ...), onClick={async () => ...} 등 void 자리에 Promise 가 들어가는 패턴 차단.
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            arguments: true,
            attributes: false, // JSX 이벤트 핸들러(onClick 등)는 일반적으로 허용
            properties: true,
            returns: true,
            variables: true,
          },
          checksConditionals: true,
        },
      ],
      // Promise 가 아닌 값을 await 하는 실수(반대로 await 누락 신호도 됨) 차단.
      "@typescript-eslint/await-thenable": "error",
    },
  },
  // ────────────────────────────────────────────────────────────────
  // (선택) 위 규칙을 특정 영역에만 적용하고 싶을 때 사용.
  // 위 전역 블록을 삭제/주석처리한 뒤 아래 블록의 주석을 해제하면 된다.
  // ServerAction 파일 + lib/db 자체 검증만 대상으로 좁히는 예시.
  // ────────────────────────────────────────────────────────────────
  // {
  //   files: [
  //     "app/**/_actions/**/*.{ts,tsx}",
  //     "actions/**/*.{ts,tsx}",
  //     "lib/db/**/*.{ts,tsx}",
  //   ],
  //   languageOptions: {
  //     parserOptions: {
  //       projectService: true,
  //       tsconfigRootDir: import.meta.dirname,
  //     },
  //   },
  //   rules: {
  //     "@typescript-eslint/no-floating-promises": [
  //       "error",
  //       { ignoreVoid: true, ignoreIIFE: true },
  //     ],
  //     "@typescript-eslint/no-misused-promises": [
  //       "error",
  //       {
  //         checksVoidReturn: {
  //           arguments: true,
  //           attributes: false,
  //           properties: true,
  //           returns: true,
  //           variables: true,
  //         },
  //         checksConditionals: true,
  //       },
  //     ],
  //     "@typescript-eslint/await-thenable": "error",
  //   },
  // },
]);

export default eslintConfig;
