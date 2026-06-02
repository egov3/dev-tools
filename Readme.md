# планируемая структура 
src/
├── bin/
│   └── codecheck.ts
├── commands/
│   ├── dead-code.ts
│   ├── comments-lint.ts
│   ├── dump-files.ts
│   └── dead-css.ts
├── utils/
│   ├── config.ts
│   └── logger.ts
└── index.ts


# Цель 
1. В package.json пакета:
{
  "bin": {
    "codecheck": "./bin/codecheck.js"
  }
}
2.
После установки:

yarn add -D @egov3/codecheck
3. можно запускать:

npx codecheck dead-code
npx codecheck comments-lint
npx codecheck dump-files
npx codecheck dead-css



или через package.json проекта:

{
  "scripts": {
    "dead-code": "codecheck dead-code",
    "comments:lint": "codecheck comments-lint",
    "dump:files": "codecheck dump-files",
    "dead-css": "codecheck dead-css"
  }
}

