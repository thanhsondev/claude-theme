Hình nền pixel/ASCII chuyển động toàn cửa sổ cho app Claude Desktop trên Windows (tab Code), kèm bot Claude mini trên ô chat.

## Cài đặt

1. Tải `pixel-themes-claude-desktop.zip` bên dưới rồi giải nén.
2. Thoát hẳn Claude Desktop, bấm đúp `1-bat-devtools.bat`, mở lại app.
3. Trong app nhấn `Ctrl + Alt + I`, chọn tab Console, dán toàn bộ nội dung `pixel-themes-claude-desktop.js` rồi nhấn Enter.

## Mới trong v1.3.0

- **Ông già Noel tặng quà**: lâu lâu đoàn xe bay xuống đậu cạnh bot, hai bên nói chuyện qua lại, ông thả hộp quà, bot mở quà (giấy màu tung ra) rồi ông chào bay đi.
- **Cảm xúc trên mặt bot Claude**: mắt, miệng, má hồng đổi theo tâm trạng (vui, thương, ngạc nhiên, buồn ngủ, đang nghĩ, buồn), kèm biểu tượng ♪ ♥ ! ? z bay cạnh đầu. Tự đổi theo tình huống: bị chuột chọc, task xong, đang chạy task, khuya...
- **Nhà của bot**: nhà gỗ có ống khói bốc khói, cửa sổ sáng đèn và 2 cây thông có đèn ở đầu phải ô chat. Theme Giáng Sinh có tuyết trên mái, dây đèn màu, vòng nguyệt quế. Lâu lâu bot vào nhà nghỉ rồi ra.
- **Bot Codex**: robot pixel tự vẽ (màn hình `>_`) đi dạo và chơi với bot Claude: nói chuyện, đuổi bắt, đập tay, ném tuyết (theme Giáng Sinh).
- **Khung lựa chọn cuối lượt chat** có nền đặc, nút phụ nhìn rõ (trước đây bị chìm vào hình nền tối).
- Ô bật/tắt mới trong `Alt + T`: "Nhà của bot", "Bot Codex".

## Mới trong v1.2.0

- **Theme "Giáng Sinh"** (`/theme noel`): đêm tuyết, rừng thông giăng đèn nhấp nháy, tuyết rơi 3 lớp (dạt ra khi rê chuột). Xe trượt ông già Noel lượn tự do trên trời, tuần lộc nối đuôi theo vệt đường.
- **Tiếng thật**: lâu lâu ông già Noel hô "hô hô hô" (kèm bong bóng thoại) và chuông tuần lộc reng. Âm thanh CC0 từ BigSoundBank, nằm trong thư mục `sounds/`.
- **Nhạc nền 8-bit 5 bài**: Jingle Bells, We Wish You a Merry Christmas, Deck the Halls, Silent Night, Joy to the World. Hàng "Nhạc:" trong `Alt + T` để chọn bài, chuyển bài, chỉnh âm lượng.
- **Bot Claude**: đội nón Noel, đi tự do khắp cửa sổ, lâu lâu nói một câu (khi Claude bắt đầu/làm xong task, khi bị chuột chọc, khi khuya...). Tuyết đọng trên ô chat thì bot vác chổi ra quét.
- **Nền tối sau chữ**: dải nền tối mờ sau cột chữ cho dễ đọc, chỉnh độ đậm trong `Alt + T`. Mưa code giờ nằm dưới lớp này, không đè lên chữ nữa.
- Mọi phần mới đều có ô bật/tắt riêng trong `Alt + T`.

Để nguyên thư mục `sounds/` cạnh launcher. Các phần mới nằm trong `custom-themes.js` và chỉ có khi chạy bằng launcher (xem `HUONG-DAN.txt`, mục "Cách khác").

## Mới trong v1.1.0

- **Launcher** `claude-theme-launcher.ps1`: tạo shortcut tới file này, mở app là theme tự nạp, không phải dán tay vào Console nữa.
- **Theme "Code Bốc Lửa"**: chữ code bốc lên từ lớp than hồng, đổi màu trắng, vàng, cam, đỏ rồi tắt.
- **Mưa code khi Claude đang chạy task**: phủ lên mọi theme, task xong thì tắt dần.
- Sửa lỗi theme tự nhảy về Sakura/Moonlit: tắt ô "Tự đổi ngày/đêm" một lần.

Chi tiết và cách xử lý lỗi nằm trong `HUONG-DAN.txt` và [README](https://github.com/thanhsondev/claude-theme#readme).

Bản tự làm, không phải sản phẩm của Anthropic. Dựa trên [Pixel Chat Themes](https://github.com/aqua2409z/pixel-chat-themes) của aqua2409z (MIT).
