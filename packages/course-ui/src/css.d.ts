/**
 * Side-effect imports of stylesheets.
 *
 * The KaTeX stylesheet is imported by the application that uses the renderer,
 * so this declaration only has to make the import legal.
 */
declare module '*.css' {
  const content: string
  export default content
}
