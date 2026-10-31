import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: [".next/**", "node_modules/**", "supabase/**", "tests/e2e/screenshots/**"] },
];
export default config;
