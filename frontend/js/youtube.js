export function parseVideoId(u) {
  const m = u.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/);
  return m ? m[1] : /^[\w-]{11}$/.test(u.trim()) ? u.trim() : null;
}

const YT_ERRORS = {
  2: 'Link video không hợp lệ.', 5: 'Trình phát HTML5 gặp lỗi.',
  100: 'Video không tồn tại hoặc ở chế độ riêng tư.',
  101: 'Chủ video không cho phép nhúng video này.', 150: 'Chủ video không cho phép nhúng video này.',
};
let apiReady, player, onError = () => {};

function loadApi() {
  return (apiReady ??= new Promise((ok, fail) => {
    window.onYouTubeIframeAPIReady = ok;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => fail(new Error('Không tải được YouTube Player (kiểm tra mạng).'));
    document.head.append(s);
  }));
}

export async function loadVideo(id, errorCb) {
  onError = (c) => errorCb(YT_ERRORS[c] || `Lỗi trình phát YouTube (${c}).`);
  await loadApi();
  document.getElementById('vhint').hidden = true;
  if (player) return player.cueVideoById(id);
  return new Promise((ok) => {
    player = new YT.Player('player', {
      videoId: id, playerVars: { rel: 0, playsinline: 1 },
      events: {
        onReady: () => {
          player.cueVideoById(id);
          ok(player);
        },
        onError: (e) => onError(e.data),
      },
    });
  });
}
export const getPlayer = () => player;
