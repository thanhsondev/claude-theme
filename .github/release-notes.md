Hình nền pixel/ASCII chuyển động toàn cửa sổ cho app Claude Desktop trên Windows (tab Code), kèm bot Claude mini trên ô chat.

## Cài đặt

1. Tải `pixel-themes-claude-desktop.zip` bên dưới rồi giải nén.
2. Thoát hẳn Claude Desktop, bấm đúp `1-bat-devtools.bat`, mở lại app.
3. Trong app nhấn `Ctrl + Alt + I`, chọn tab Console, dán toàn bộ nội dung `pixel-themes-claude-desktop.js` rồi nhấn Enter.

## Mới trong v1.1.0

- **Launcher** `claude-theme-launcher.ps1`: tạo shortcut tới file này, mở app là theme tự nạp, không phải dán tay vào Console nữa (xem `HUONG-DAN.txt`, mục "Cách khác").
- **Theme "Code Bốc Lửa"**: chữ code bốc lên từ lớp than hồng, đổi màu trắng, vàng, cam, đỏ rồi tắt.
- **Mưa code khi Claude đang chạy task**: phủ lên mọi theme, task xong thì tắt dần.
- Sửa lỗi theme tự nhảy về Sakura/Moonlit: tắt ô "Tự đổi ngày/đêm" một lần.

Hai phần mới về theme nằm trong `custom-themes.js` và chỉ có khi chạy bằng launcher.

Chi tiết và cách xử lý lỗi nằm trong `HUONG-DAN.txt` và [README](https://github.com/thanhsondev/claude-theme#readme).

Bản tự làm, không phải sản phẩm của Anthropic. Dựa trên [Pixel Chat Themes](https://github.com/aqua2409z/pixel-chat-themes) của aqua2409z (MIT).
