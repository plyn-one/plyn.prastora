/* Prastora colour switch, optional: the core works without it, and then the system decides.
   Use: <script src="…/theme.js" defer></script> at the end of body, and a button <button type="button" data-theme-switch hidden>.
   The button is shown by this script only, so a reader without script sees no switch. The choice is kept on the device
   (localStorage 'prastora.theme'); with no choice the system decides. To avoid a flash of the other scheme on a page that
   opens with a saved choice, the first line below may also sit in <head> as an inline script (it is one line). */
(() => {
  const root = document.documentElement;
  const key = 'prastora.theme';
  const read = () => { try { return localStorage.getItem(key); } catch (e) { return null; } };
  const write = (value) => { try { localStorage.setItem(key, value); } catch (e) { /* the switch still works for this page */ } };
  const saved = read();
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  const system = matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : system.matches);
  document.querySelectorAll('[data-theme-switch]').forEach((button) => {
    button.hidden = false;
    button.addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      root.dataset.theme = next;
      write(next);
    });
  });
})();
