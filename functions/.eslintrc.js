module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
  },
  extends: [
    "eslint:recommended",
  ],
  rules: {
    "no-unused-vars": "off",
    "indent": "off",
    "object-curly-spacing": "off",
    "comma-dangle": "off",
  },
};
