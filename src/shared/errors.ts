/** Show an error message inside the view and hide the loading spinner. */
export function showError(msg: string): void {
  const el = document.getElementById('error-msg');
  if (el) {
    el.textContent = msg;
    el.style.display = 'flex';
  }
  const loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
}
