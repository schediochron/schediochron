// Replaces vite/client: types the CSS imports the bundler rewrites.
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.css';
