# Pixel Themes cho Claude Desktop

Hình nền pixel/ASCII chuyển động phủ toàn cửa sổ cho app **Claude Desktop trên Windows** (tab Code), kèm một con bot Claude mini đi lại trên ô chat.

Đây là bản sửa từ [Pixel Chat Themes](https://github.com/aqua2409z/pixel-chat-themes) của aqua2409z, chỉnh lại để chạy trong app Claude Desktop thay vì trang web claude.ai.

> Bản tự làm, không phải sản phẩm của Anthropic. Khi app cập nhật, giao diện có thể thay đổi và script có thể hiển thị sai.

## Có gì

- 11 theme: Claude Code, Claude Ivory, Cloud Drift, Honu Lagoon, Koi Pond, Jellyfish, Paper Boats, Fireflies, Moonlit, Việt Nam, Sakura Breeze.
- Hình nền phủ cả cửa sổ app, không chỉ khung chat.
- Chữ luôn đọc được: viền tương phản cho chữ, nền đặc cho bong bóng chat, menu và hộp thoại.
- Bot Claude mini trên ô chat.
- Bảng chọn theme (`Alt + T`) với các tuỳ chọn: làm dịu cột chat, mật độ, tốc độ, bật/tắt chuyển động, tự đổi theme ngày/đêm.

## Cài đặt

1. Tải file `pixel-themes-claude-desktop.zip` ở trang [Releases](https://github.com/thanhsondev/claude-theme/releases/latest) rồi giải nén.
2. Làm theo file `HUONG-DAN.txt` trong thư mục vừa giải nén.

Tóm tắt các bước:

1. **Bật DevTools (một lần):** thoát hẳn Claude Desktop, bấm đúp `1-bat-devtools.bat`, mở lại app.
   File này chỉ ghi dòng `"allowDevTools": true` vào `developer_settings.json` trong thư mục dữ liệu của Claude Desktop.
2. **Chạy script:** trong app nhấn `Ctrl + Alt + I`, chọn tab Console, dán toàn bộ nội dung `pixel-themes-claude-desktop.js` rồi nhấn Enter.
   Lần đầu Console sẽ yêu cầu gõ `allow pasting` trước khi cho dán.
3. **Lưu thành Snippet** (tab Sources → Snippets, đặt tên `pixel`) để lần sau chạy nhanh: `Ctrl + Alt + I` → `Ctrl + P` → gõ `!pixel` → Enter.

Mỗi lần mở lại app phải chạy lại script. Đóng app là mọi thứ trở về như cũ.

## Tự nạp theme mỗi lần mở app (launcher)

`claude-theme-launcher.ps1` làm thay bước 2: mở Claude Desktop (nếu chưa mở), mở DevTools, dán script vào Console, rồi đóng DevTools.
Theme bạn đã chọn bằng `Alt + T` được giữ nguyên giữa các lần mở.

1. Làm Bước 1 ở trên (bật DevTools) và khởi động lại app một lần.
2. Tạo shortcut trên Desktop với đích:
   ```
   powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "<thư mục>\claude-theme-launcher.ps1"
   ```
3. Mở app bằng shortcut này. Lần đầu launcher tự gõ `allow pasting` cho Console.

Trong lúc launcher chạy (khoảng 15 giây) đừng bấm sang cửa sổ khác. Launcher chỉ gõ phím khi cửa sổ đang focus đúng là DevTools của Claude. Nếu mất focus, nó dừng và đóng DevTools lại.
Nhật ký nằm ở `launcher.log`, cạnh file script.

Tuỳ chọn: `-Random` đổi sang theme ngẫu nhiên mỗi lần mở, `-NoClose` giữ DevTools mở để xem lỗi, `-LoadWait 20` chờ app load lâu hơn trên máy chậm.

### Phần thêm (`custom-themes.js`)

Launcher tự ghép file này vào script chính. Khi dán tay thì phần này không có.

- **Theme "Code Bốc Lửa"** (`/theme lua`): chữ code bốc lên từ lớp than hồng ở đáy, đổi màu trắng, vàng, cam, đỏ rồi tắt.
- **Mưa code khi Claude đang chạy task:** khi phiên đang mở có nút Dừng, code rơi phủ lên mọi theme, task xong thì tắt dần. Gỡ lỗi: `__pxtRain.force = true` / `false` / `null`.
- **Tắt "Tự đổi ngày/đêm" một lần:** khi tuỳ chọn này bật, theme bị ép về Sakura hoặc Moonlit mỗi phút. Muốn dùng lại thì tick lại trong `Alt + T`.

## Cách dùng

- `Alt + T` hoặc nút ô vuông màu ở cạnh phải: mở bảng chọn theme.
- Chọn **Tắt** trong bảng để tắt hình nền.
- Khi chạy bản script mới mà bản cũ còn đang chạy: gõ `location.reload()` trong Console trước.

## Lỗi thường gặp

| Hiện tượng | Cách xử lý |
| --- | --- |
| Chữ trắng trên nền trắng, menu khó đọc với theme tối | Vào Settings của Claude Desktop, đổi Appearance sang Dark. |
| Hình nền và bot đứng yên | Nhấn `Alt + T`, tick "Chuyển động" và bỏ tick "Đứng yên khi Windows tắt hiệu ứng động". |
| `Ctrl + Alt + I` không mở gì | Thoát hẳn app (cả ở khay hệ thống) rồi mở lại sau khi chạy file `.bat`. |
| Chạy bản mới mà không thấy thay đổi | Gõ `location.reload()` trong Console rồi chạy lại. |

Khi báo lỗi, gõ dòng sau trong Console và gửi kèm kết quả (được chép vào clipboard):

```js
copy(JSON.stringify(__pixelThemes.debug()))
```

## An toàn

Script chỉ đổi cách hiển thị trong cửa sổ app. Nó không gửi dữ liệu đi đâu và không đọc nội dung chat. Toàn bộ mã nằm trong một file `.js`, bạn có thể mở ra để tự kiểm tra trước khi chạy.

## Gỡ bỏ

- Xoá Snippet `pixel` trong DevTools. Script không cài gì vào máy.
- Muốn tắt DevTools: xoá file `developer_settings.json` đã tạo ở bước 1.

## Giấy phép

MIT. Bản gốc © 2026 aqua2409z, xem [LICENSE](LICENSE).
