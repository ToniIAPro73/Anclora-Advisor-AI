const script = `
(() => {
  const locale = localStorage.getItem("anclora.locale") === "en" ? "en" : "es";
  const themeModeRaw = localStorage.getItem("anclora.theme_mode");
  const themeMode = themeModeRaw === "light" || themeModeRaw === "dark" || themeModeRaw === "system"
    ? themeModeRaw
    : "dark";
  const sidebarCollapsed = localStorage.getItem("anclora.sidebar_collapsed") === "true";
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolvedTheme = themeMode === "system" ? (prefersDark ? "dark" : "light") : themeMode;
  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themeMode = themeMode;
  document.documentElement.dataset.sidebar = sidebarCollapsed ? "collapsed" : "expanded";
})();
`;

export function AppPreferencesScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
