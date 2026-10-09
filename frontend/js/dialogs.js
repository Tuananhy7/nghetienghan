const $ = (id) => document.getElementById(id);
export const getKey = () => localStorage.getItem('geminiKey') || '';

/** Hộp xác nhận trước khi dùng AI. Trả về true nếu người dùng đồng ý. */
export function confirmAI({ title, body, needKey }) {
  return new Promise((resolve) => {
    const dlg = $('dlg');
    $('dt').textContent = title;
    $('db').textContent = body;
    $('keyrow').hidden = !needKey;
    $('key').value = '';
    dlg.returnValue = '';
    dlg.onclose = () => {
      if (dlg.returnValue !== 'yes') return resolve(false);
      const k = $('key').value.trim();
      if (needKey && !k) return resolve(false);
      if (k) localStorage.setItem('geminiKey', k);
      resolve(true);
    };
    dlg.showModal();
  });
}
