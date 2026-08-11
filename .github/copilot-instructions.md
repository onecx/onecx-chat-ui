This repository uses Angular.

Before changing code:
- Analyze package.json.
- Check angular.json.
- Follow the existing coding style.
- Detect whether Karma/Jasmine or Jest is used by checking the packages in package.json. The package.json is the only evidence you are allowed to use while detecting the used framework. Do not try to derive this from the used functions in a test file so similar.
- Do not change the testing framework unless explicitly instructed.
- Explain all breaking changes before modifying code.
- Keep the section of imports in the same order as it is in the original file.
- Use english as the language for comments and documentation.
