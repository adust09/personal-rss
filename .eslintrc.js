module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    // Error prevention
    'no-console': 'off', // Allow console for logging in Node.js
    'no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_|^code$',
        varsIgnorePattern: '^_|^summary$|^output$'
      }
    ],
    'no-undef': 'error',

    // Code style
    indent: 'off', // Disable indent rule to let Prettier handle it
    'linebreak-style': ['error', 'unix'],
    quotes: ['error', 'single'],
    semi: ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'comma-spacing': 'error',
    'key-spacing': 'error',
    'space-before-blocks': 'error',
    'space-infix-ops': 'error',
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],

    // Best practices
    eqeqeq: 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'no-trailing-spaces': 'error',
    'eol-last': 'error'
  },
  overrides: [
    {
      files: ['test/**/*.js'],
      env: {
        jest: true
      },
      globals: {
        testUtils: 'readonly'
      },
      rules: {
        'no-unused-expressions': 'off'
      }
    }
  ]
};
