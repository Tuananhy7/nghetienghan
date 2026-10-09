let id;
/** Gọi tick() mỗi 200ms để đọc thời gian player và cập nhật câu đang phát. */
export function startSync(tick) { clearInterval(id); id = setInterval(tick, 200); }
