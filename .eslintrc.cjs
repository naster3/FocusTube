module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ["@typescript-eslint", "react", "react-hooks"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier",
  ],
  settings: {
    react: {
      version: "detect",
    },
  },
  ignorePatterns: ["dist/", "node_modules/", "coverage/"],
  rules: {
    "react/react-in-jsx-scope": "off",
    "react/no-danger": "error",
    "no-restricted-properties": [
      "error",
      {
        object: "document",
        property: "write",
        message: "Avoid document.write. Use createElement/textContent instead.",
      },
      {
        object: "document",
        property: "writeln",
        message: "Avoid document.writeln. Use createElement/textContent instead.",
      },
    ],
    "no-restricted-syntax": [
      "error",
      {
        selector: "MemberExpression[property.name='innerHTML']",
        message: "Avoid innerHTML. Use textContent/createElement instead.",
      },
      {
        selector: "MemberExpression[property.name='outerHTML']",
        message: "Avoid outerHTML. Use createElement instead.",
      },
      {
        selector: "MemberExpression[property.name='insertAdjacentHTML']",
        message: "Avoid insertAdjacentHTML. Use createElement instead.",
      },
    ],
  },
};
