# SPEC: Trình tạo Word Search và Word Scramble (web, chạy mọi thiết bị)

Tài liệu này dành cho người thực hiện dự án. Đọc hết trước khi viết code. Làm theo từng giai đoạn ở mục 12.

## 0. Chuẩn bị thư mục dự án

```
puzzle-maker/
  SPEC.md                       (file này)
  reference/
    halloween-wordsearch-hard.pdf    (mẫu A)
    halloween-wordsearch-easy.pdf    (mẫu B)
    halloween-wordscramble.pdf       (mẫu C)
```

Ba PDF mẫu là nguồn sự thật cho bố cục đầu ra. Đây là các mẫu miễn phí do chính nhà sản xuất phần mềm gốc công bố trên trang qualint.com/samples.

## 1. Mục tiêu

- Web app tĩnh (static), chạy trên Windows, macOS, Linux, iPad, iPhone, Android bằng trình duyệt. Việc tạo đố, xem trước, in và xuất file chạy hoàn toàn trên trình duyệt, không cần server.
- Tài khoản và lưu project là tính năng **tuỳ chọn**, dùng Supabase (PostgreSQL). Không đăng nhập vẫn dùng đầy đủ mọi tính năng tạo đố; đăng nhập chỉ cần khi muốn lưu project. Nếu bản build không có cấu hình backend (`VITE_SUPABASE_URL`) thì app chạy như bản chỉ-khách, không hiện nút đăng nhập.
- Có 3 loại đố: **Word Search**, **Word Scramble** và **Crossword**, cộng chế độ **Kết hợp** (Combine) ghép hai loại vào một bản in.
- **Crossword**: sinh từ danh sách từ (các từ phải có chữ chung để giao nhau; từ không giao được thì báo "Not in the crossword"). Lưới ưu tiên dạng vuông, chỉ vẽ các ô có chữ, đánh số theo thứ tự đọc. Danh sách gợi ý chia Across (trái) và Down (phải); có tuỳ chọn hiện số chữ và ngân hàng từ (Word Bank). Không nhập gợi ý nào thì tự in Word Bank để vẫn giải được. Nếu một trang không đủ chỗ cho lưới đọc được (ô tối thiểu 5 mm) cùng gợi ý thì tách thành hai trang: lưới một trang, gợi ý trang sau.
- **Kết hợp**: chọn một trong ba cặp (Word Search + Scramble, Word Search + Crossword, Crossword + Scramble). Dùng chung một danh sách từ và chung tiêu đề, dòng tên, chân trang. Mỗi loại có trang riêng trong cùng một file/lần in; mọi trang đề đứng trước, sau đó mới đến các trang đáp án, cùng thứ tự cặp. Cài đặt riêng của từng loại vẫn hiện đầy đủ. Xuất PNG, PDF và in đều dùng chung đường xử lý với chế độ đơn.
- **Không lưu dữ liệu đầu vào**: thoát ra vào lại là trang trắng. Cấm dùng localStorage, sessionStorage, IndexedDB, cookie để lưu danh sách từ hay cài đặt. Mọi trạng thái nằm trong bộ nhớ. Ngoại lệ duy nhất: thư viện Supabase giữ token phiên đăng nhập trong localStorage khi người dùng đã đăng nhập. Danh sách từ chỉ được ghi vào cơ sở dữ liệu khi người dùng đã đăng nhập và chủ động bấm Lưu project.
- **Nhật ký phiên**: mỗi lượt truy cập (cả khách) ghi một dòng vào `work_sessions`: thời điểm, user agent và bộ đếm hành động (png, pdf, print, share, regenerate). Không bao giờ gửi danh sách từ, tiêu đề hay bất kỳ nội dung nào người dùng nhập. Chỉ admin đọc được bảng này. Admin xem nhật ký, thống kê và danh sách tài khoản (đổi vai trò) trong hộp thoại **Admin** ở menu tài khoản.
- **Quản trị (admin)**: admin xem được mọi project đang dùng của người dùng (không bao giờ thấy thùng rác của họ, không thấy mật khẩu), sửa tên, email và vai trò của người dùng, và xem từng lượt truy cập của khách lẫn người dùng gồm ngày giờ chính xác và thiết bị (trình duyệt và loại máy, ví dụ Safari on iPhone). Admin mở project của người khác ở dạng **bản sao**: lưu sẽ tạo project mới của admin, không ghi đè bản gốc. Mọi quyền này do database ép (RLS và hàm security definer), giao diện chỉ là lớp trình bày.
- **Quên mật khẩu**: không gửi email. Yêu cầu chuyển cho admin; admin duyệt thì mật khẩu về mặc định `123456`, mọi phiên đăng nhập của tài khoản bị đóng, và lần đăng nhập kế tiếp người dùng bị yêu cầu đặt mật khẩu mới. Mỗi tài khoản chỉ có một yêu cầu đang chờ, tối đa 5 yêu cầu mỗi giờ, và phản hồi luôn giống nhau dù email có tồn tại hay không.
- **Project và thùng rác**: người dùng đã đăng nhập lưu, mở lại và xoá mềm project (cột `deleted_at`). Thùng rác cho khôi phục hoặc xoá vĩnh viễn, đều chọn nhiều được. Project chỉ xoá vĩnh viễn được khi đã nằm trong thùng rác, giữ đến khi người dùng tự xoá.
- Sản phẩm đầu ra (xem trước, in, PNG, PDF) có bố cục **giống các mẫu A, B, C** ở mục 3.
- Lưới Word Search cho chỉnh kích thước **tự do**: số hàng và số cột độc lập, tối thiểu 5, tối đa 100 (hằng số `MAX_GRID`). Phải kiểm thử đạt yêu cầu ở 32×32 và 64×64.
- Chỉ có 3 nút hành động chính: **Lưu PNG**, **Lưu PDF**, **In**.

## 2. Ngoài phạm vi và lưu ý bản quyền

- Không làm: ghép hai loại đố trên cùng một trang (mỗi loại một trang riêng), danh sách từ riêng cho từng loại trong bản kết hợp, app native, lưu danh sách từ khi chưa đăng nhập.
- Không dùng tên, logo hay câu chữ "Qualint" và "Wordsheets" trong sản phẩm. Dòng footer mặc định để trống, người dùng tự nhập. Đặt tên app ở một hằng số `APP_NAME` để dễ đổi.
- Chỉ tái tạo định dạng chung của một tờ đố. Không sao chép mã, ảnh hay giao diện của phần mềm gốc.

## 3. Phân tích 3 mẫu PDF

### Dữ liệu

**Mẫu A** (word search khó, lưới 20×20, 20 từ):
Halloween, Orange, Black, Cat, Witch, Warlock, Ghost, Goblin, Jack O Lantern, Trick, Treat, Costume, Candy, Monster, Vampire, Werewolf, Mummy, Bat, Cauldron, Broom

**Mẫu B** (word search dễ, lưới 10×10, 10 từ):
Orange, Black, Cat, Witch, Ghost, Trick, Treat, Candy, Bat, Broom

**Mẫu C** (word scramble, 20 từ, cùng danh sách và cùng thứ tự với mẫu A):
bản xáo là NHAEWLLEO, OGERAN, LABKC, TCA, TIHCW, OACWKRL, SHOTG, LINOBG, JKAC O TNAENLR, KTCIR, TREAT, MSCETUO, DANCY, TNSOERM, IEMAPRV, EFREWOLW, MMUMY, ABT, OURACLND, BOORM.
Số dấu gạch dưới mỗi dòng: 9, 6, 5, 3, 5, 7, 5, 6, 12, 5, 5, 7, 5, 7, 7, 8, 5, 3, 8, 5 (đúng bằng số chữ cái của từng từ).

### Quy tắc rút ra từ mẫu (đã kiểm tra trên dữ liệu)

1. **Phần đầu trang** gồm dòng `Name ______` ở trên cùng bên trái và tiêu đề căn giữa. Dòng ghi chú của hãng (ở app của ta là footer tùy chọn) theo tài liệu hãng nằm ở cuối trang. Cả ba thành phần đều tắt/bật và sửa chữ được.
2. **Danh sách từ** giữ nguyên cách viết hoa/thường người dùng gõ (Title Case) và giữ dấu cách trong từ nhiều chữ ("Jack O Lantern"). Xếp **4 cột**, điền theo hàng, đúng thứ tự nhập: 20 từ thành 5 hàng × 4 cột, 10 từ thành các hàng 4, 4, 2.
3. **Lưới**: chữ IN HOA, mỗi chữ nằm giữa ô, các ô cách đều. Từ nhiều chữ được nối liền trong lưới (JACKOLANTERN).
4. **Chữ lấp ô trống**: ngẫu nhiên đều trên A–Z. Mẫu A có nhiều J, Q, X, Z nên mặc định không ưu tiên chữ thường gặp.
5. **Hướng đặt từ**: mẫu A dùng đủ 8 hướng (ví dụ HALLOWEEN ngược ở hàng 13, WEREWOLF ngược ở hàng 20, TRICK chéo ngược). Mẫu B chỉ có ngang trái→phải và dọc trên→xuống (mô tả của hãng: dành cho trẻ nhỏ, không có từ ngược hay chéo).
6. **Mật độ chữ**: mẫu A có 123 chữ trong 400 ô (31%), mẫu B có 47 chữ trong 100 ô (47%).
7. **Word Scramble**: đánh số 1–20 theo đúng thứ tự danh sách. Mỗi từ được xáo **riêng rẽ** và giữ ranh giới từ ("JACK O LANTERN" thành "JKAC O TNAENLR"). Số dấu gạch bằng số chữ cái (không tính dấu cách).
8. **Lỗi cần tránh**: mẫu C có dòng 11 là "TREAT" xáo ra đúng bằng từ gốc. App của ta phải đảm bảo bản xáo khác từ gốc.
9. **Đáp án**: ba file mẫu không kèm đáp án. Theo mô tả của hãng, đáp án word search khoanh tròn từng từ và đánh dấu chữ đầu tiên.

### Việc đầu tiên (Giai đoạn 0)

Văn bản trích từ PDF **không cho biết** font, cỡ chữ, khung viền, khoảng cách, vị trí chính xác. Hãy render 3 PDF thành ảnh (ví dụ `pdftoppm -r 100 -png`, hoặc đọc PDF trực tiếp), quan sát, rồi ghi số đo ước lượng vào `reference/NOTES.md` (tỉ lệ tiêu đề / danh sách / lưới, có khung ngoài lưới hay không, có đường kẻ ô hay không, kiểu dòng gạch của scramble, vị trí số thứ tự). Các số mặc định ở mục 7 chỉ là điểm xuất phát, phải chỉnh theo ảnh này.

## 4. Word Search: tính năng

| Tùy chọn | Mặc định | Ghi chú |
|---|---|---|
| Tiêu đề | rỗng | căn giữa |
| Dòng "Name" | bật | nhãn sửa được (Name / Họ tên / Tên) |
| Footer | rỗng | căn giữa, cuối trang |
| Kích thước | Tự động | hoặc Thủ công: Hàng × Cột, mỗi chiều 5–100, không bắt buộc vuông. Preset nhanh: 10, 15, 20, 32, 48, 64. Có nút khóa "vuông" |
| Hướng đặt từ | Khó (8 hướng) | 8 ô chọn riêng: → ← ↓ ↑ ↘ ↖ ↗ ↙. Preset: Dễ (→ ↓), Vừa (→ ↓ ↘), Khó (cả 8). Thêm 2 công tắc nhanh "cho phép từ ngược", "cho phép đường chéo" |
| Cho phép các từ giao nhau | bật | giao nhau chỉ hợp lệ khi chữ trùng khớp |
| Chữ lấp ô trống | đều A–Z | hoặc "lấy từ các chữ trong danh sách" (khó hơn) |
| Tiếng Việt | bỏ dấu | hoặc giữ dấu (mục 6) |
| Danh sách từ | hiện từ | hoặc hiện gợi ý (clue), cả hai, hoặc ẩn |
| Số cột danh sách | 4 | 1–6 hoặc tự động |
| Vị trí danh sách | trên lưới | hoặc tách sang trang riêng |
| Kiểu lưới | theo mẫu | bật/tắt khung ngoài và đường kẻ ô, font, chữ đậm |
| Preset "Trẻ nhỏ" | tắt | chỉ → ↓, lưới nhỏ, chữ to |
| Đáp án | bật | khoanh tròn từng từ và chấm ở chữ đầu |
| Khổ giấy | A4 dọc | Letter, A3, dọc/ngang |
| Seed | ngẫu nhiên | hiển thị để tái tạo đúng lưới đó |

Từ không đặt được: vẫn hiển thị lưới, báo rõ trong giao diện ("Không đặt được: X, Y. Hãy tăng kích thước hoặc bật thêm hướng") và **không** in các từ đó trong danh sách.

Cảnh báo dễ đọc: tính cỡ chữ của lưới theo pt. Nếu dưới 6pt thì báo vàng ("chữ nhỏ khi in, nên dùng khổ A3 hoặc giảm kích thước"), dưới 4pt thì báo cảnh báo mạnh. Không chặn người dùng. Tham khảo: lưới 64 cột trên A4 dọc cho chữ cỡ khoảng 5pt.

## 5. Word Scramble: tính năng

| Tùy chọn | Mặc định | Ghi chú |
|---|---|---|
| Tiêu đề, dòng Name, footer | như mục 4 | |
| Chữ đầu | tự do | "giữ nguyên chữ đầu" hoặc "bắt buộc đổi chữ đầu" |
| Chữ gợi ý | không | không / chữ đầu / chữ đầu và cuối / k chữ ngẫu nhiên, hiện sẵn trong ô gạch |
| Cột | tự động | một cột; nếu hơn 25 mục thì tự chia hai cột và nhiều trang |
| Gợi ý (clue) | tắt | nếu có, in clue cạnh bản xáo |
| Đáp án | bật | điền chữ in đậm vào các ô gạch |

Quy tắc xáo (chỉ dùng RNG có seed):

1. Xáo từng từ riêng, giữ ranh giới từ. Từ một chữ giữ nguyên.
2. Bản xáo phải khác từ gốc. Nếu từ có ít nhất 2 chữ khác nhau thì thử lại đến khi khác (tối đa 50 lần). Nếu không thể (ví dụ "AA", "OO"), giữ nguyên và báo trong giao diện.
3. Dấu gạch: mỗi chữ một gạch ngắn, cách đều. Chỗ ranh giới từ chừa khoảng trống rộng hơn một nhịp. Kiểm tra với mẫu C xem khoảng trống đó có thật không và làm giống.
4. Bố cục mặc định (xác nhận với PDF mẫu): `n. BẢN_XÁO` bên trái, dãy gạch bên phải cùng dòng, các dòng cách đều để lấp đầy trang, tối đa khoảng 14 mm mỗi dòng.

## 6. Nhập liệu và tiếng Việt

- Một ô nhập nhiều dòng, mỗi dòng một mục. Cho dán từ Excel/Google Sheets: dòng có Tab hoặc ký tự `|` tách thành `đáp án | gợi ý`.
- Chuẩn hóa: bỏ khoảng trắng thừa, bỏ dòng trống, bỏ trùng không phân biệt hoa thường (có báo "đã bỏ N từ trùng").
- Chuỗi dùng cho lưới: bỏ mọi ký tự không phải chữ cái (dấu cách, gạch nối, dấu nháy, chữ số), rồi viết hoa. Chuỗi hiển thị trong danh sách giữ nguyên bản gốc.
- Từ dưới 2 chữ cái trong lưới, hoặc dài hơn cả hai cạnh lưới: loại ra và báo lý do.
- **Chế độ bỏ dấu**: `normalize('NFD')`, bỏ dấu kết hợp, đổi đ/Đ thành D. Ví dụ "Đà Nẵng" thành `DANANG`.
- **Chế độ giữ dấu**: dùng `normalize('NFC')`, mỗi chữ có dấu là **một ô**. Khi xáo, dấu luôn đi cùng chữ gốc. Bảng chữ lấp = A–Z cộng toàn bộ chữ có dấu tiếng Việt (nếu không, các chữ có dấu chỉ xuất hiện trong từ đáp án sẽ lộ ra).
- Dùng `Array.from(str)` hoặc `Intl.Segmenter`, không dùng `str[i]`.

## 7. Bố cục, xuất file

### Nguyên tắc: một nguồn sự thật

Tầng `layout` là hàm thuần, nhận (dữ liệu puzzle, tùy chọn, khổ giấy) và trả về danh sách lệnh vẽ theo **mm** (cỡ chữ theo pt). Mọi đầu ra dùng cùng danh sách này nên giống hệt nhau:

```ts
type DrawOp =
  | { t: 'text'; x: number; y: number; s: string; size: number; weight: 400 | 700;
      anchor: 'start' | 'middle' | 'end'; font: string; color: string }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; w: number; color: string }
  | { t: 'rect'; x: number; y: number; w: number; h: number; r?: number;
      stroke?: string; fill?: string; sw?: number }
  | { t: 'capsule'; x1: number; y1: number; x2: number; y2: number;
      thickness: number; stroke: string; sw: number }   // khoanh từ ở đáp án
  | { t: 'dot'; x: number; y: number; r: number; fill: string };
type Page = { widthMm: number; heightMm: number; ops: DrawOp[] };
```

Bộ vẽ: `renderSvg(page)` cho xem trước và in, `renderCanvas(page, dpi)` cho PNG và PDF. Vẽ trực tiếp bằng canvas `fillText` (sau `await document.fonts.load(...)`) để tránh lỗi font không nạp khi chuyển SVG thành ảnh.

### Giá trị khởi đầu (chỉnh theo reference/NOTES.md)

- A4 dọc 210×297 mm, lề 15 mm. Dòng Name 11pt ở trên cùng bên trái. Tiêu đề 26pt đậm căn giữa. Footer 8pt cách mép dưới 10 mm.
- Danh sách từ 12pt, giãn dòng 1.5, thu nhỏ tự động (tối thiểu 7pt) để từ dài nhất vừa cột. Nếu danh sách chiếm hơn 35% chiều cao trang thì giảm cỡ chữ, vẫn không đủ thì đề nghị chuyển sang trang riêng.
- Lưới: ô vuông, `cell = min(vùng_rộng / cột, vùng_cao / hàng)`, chữ khoảng `0.60 × cell`, căn giữa trang theo chiều ngang. Lưới không vuông thì giữ ô vuông.
- Đáp án word search: viên thuốc (capsule) bo tròn vẽ từ tâm ô đầu đến tâm ô cuối, bề dày khoảng 0.85 ô, nét mảnh; chấm đặc nhỏ ở ô đầu tiên. In đen trắng vẫn đọc rõ.

### Xuất file

- **Phạm vi xuất**: chỉ đề, chỉ đáp án, hoặc đề kèm đáp án (đáp án nằm ở trang riêng sau đề).
- **Xem trước**: SVG theo mm, mỗi trang một thẻ.
- **In**: chèn các trang SVG vào `#print-root`, ẩn mọi thứ khác trong `@media print`, đặt `@page` theo khổ giấy đã chọn bằng thẻ `<style>` sinh lúc chạy, rồi gọi `window.print()`:
  ```css
  @page { size: A4 portrait; margin: 0 }
  @media print {
    body > :not(#print-root) { display: none !important }
    .sheet { width: 210mm; height: 297mm; break-after: page }
  }
  ```
- **PNG**: mặc định 300 DPI (A4 = 2480×3508 px). Tùy chọn 150/300/600. Nhiều trang thì gói zip bằng `fflate`. Trên iOS canvas bị giới hạn khoảng 16,7 triệu điểm ảnh, nên tự hạ DPI khi vượt giới hạn.
- **PDF**: giai đoạn đầu nhúng ảnh 300 DPI mỗi trang bằng `pdf-lib` (đúng hình, không lỗi font tiếng Việt). Giai đoạn 4 mới làm PDF vector từ `DrawOp[]` với font nhúng.
- **Chia sẻ**: nếu `navigator.canShare({ files })` hợp lệ thì có nút Chia sẻ (iPad/iPhone lưu vào Files, Ảnh, AirDrop). Ngược lại tải xuống bằng thẻ `<a download>`, mở tab mới nếu thất bại.
- **Font**: đóng gói sẵn bằng `@fontsource` để cùng một kết quả trên mọi máy. Mặc định Product Sans (người dùng cung cấp, `src/assets/fonts/`, đủ tiếng Việt), có thể thêm Atkinson Hyperlegible. Danh sách font phải hiển thị được cả chữ Việt.

## 8. Thuật toán Word Search

### Sinh lưới

```
input: entries[], rows, cols, dirs[], options, seed
rng = mulberry32(seed)
for attempt in 1..MAX_ATTEMPTS (và giới hạn thời gian):
    grid = rỗng
    order = sắp theo độ dài giảm dần, hòa thì ngẫu nhiên
    for word in order:
        lấy mẫu ứng viên (r, c, dir) hợp lệ:
            nằm trọn trong lưới
            mỗi ô: trống, hoặc cùng chữ (nếu allowOverlap)
            phải có ít nhất 1 ô mới (không giấu trọn từ vào chữ có sẵn)
        chọn ngẫu nhiên có trọng số: weight = 1 + overlapBonus × số_ô_giao
        không có ứng viên → đánh dấu thất bại, thử tiếp từ khác
    nếu đặt đủ → dừng; ngược lại giữ bản đặt được nhiều từ nhất
chế độ tự động: thất bại thì tăng kích thước thêm 1 và lặp lại
điền ô trống theo chế độ chữ lấp
kiểm tra trùng: đếm số lần xuất hiện của mỗi từ theo các hướng đang bật
    nếu có lần xuất hiện thừa (không nằm trọn trong ô của từ khác đã đặt)
    thì đổi chữ lấp tại một ô trống thuộc lần xuất hiện đó, lặp tối đa 200 lần
```

Lấy mẫu ứng viên: không duyệt toàn bộ khi lưới lớn. Duyệt ngẫu nhiên đến khi có đủ (ví dụ 300 ứng viên hợp lệ) hoặc hết ngân sách, rồi chọn có trọng số.

### Kích thước tự động

Điểm xuất phát `N0 = max(độ_dài_từ_dài_nhất + 1, ceil(sqrt(tổng_chữ / 0.40)))`, kẹp trong [8, MAX_GRID], rồi tăng dần đến khi đặt đủ. Mục tiêu tham chiếu (không bắt buộc khớp tuyệt đối): với danh sách mẫu A kết quả nằm khoảng 16–24, với mẫu B khoảng 9–13. Chưa kiểm chứng cách phần mềm gốc chọn cỡ lưới.

### Hiệu năng

- Chạy trong **Web Worker** (module worker của Vite). Có thể hủy khi người dùng bấm tạo lại. Giao diện không được đơ.
- Mục tiêu: 64×64 với 150 từ xong dưới 2 giây; 100×100 với 300 từ xong dưới 8 giây và có báo tiến độ.
- RNG có seed (`mulberry32`). Cùng seed và cùng đầu vào cho đúng cùng một lưới.

### Bộ dò từ (solver)

`findWord(grid, word, dirs)` trả về mọi vị trí xuất hiện. Dùng cho kiểm tra trùng ở trên, cho test, và cho fixture mẫu.

## 9. Công nghệ và cấu trúc mã

- Vite + TypeScript (strict) + React 18 chỉ cho giao diện. Vitest cho test. Playwright (tùy chọn) cho chụp màn hình và kiểm tra in. Thư viện chạy: `pdf-lib`, `fflate`, `@fontsource/*`. Hạn chế thêm thư viện khác.
- Deploy tĩnh (Cloudflare Pages, GitHub Pages hay Netlify): `vite build` rồi đưa thư mục `dist` lên.

```
src/
  core/        rng.ts  text.ts  wordsearch/{types,generate,solve,sizing}.ts  scramble/scramble.ts
  layout/      page.ts  drawops.ts  measure.ts  layoutWordSearch.ts  layoutScramble.ts
  render/      svg.ts  canvas.ts
  export/      print.ts  png.ts  pdf.ts  share.ts
  workers/     generator.worker.ts
  ui/          App.tsx  panels/  i18n.ts  (vi, en)
tests/         core/  layout/  export/  fixtures/
```

Quy ước: hàm thuần cho `core` và `layout`, không biến toàn cục, không phụ thuộc DOM ở `core`.

## 10. Giao diện

- Hai tab: **Word Search** và **Word Scramble**, dùng chung ô nhập từ.
- Máy tính/iPad ngang: bên trái là ô nhập và tùy chọn, bên phải là xem trước các trang (đề, đáp án) có zoom. Điện thoại: một cột, chuyển qua lại giữa "Nhập liệu" và "Xem trước".
- Thanh hành động luôn thấy: **Tạo lại** (đổi seed), **Lưu PNG**, **Lưu PDF**, **In**, kèm lựa chọn phạm vi (đề / đáp án / cả hai).
- Hiển thị: bộ đếm từ, danh sách vấn đề (từ trùng, quá dài, không đặt được), cảnh báo cỡ chữ nhỏ, mã seed.
- Tùy chọn nâng cao nằm trong phần thu gọn. Kích thước lưới: hai ô số Hàng/Cột, thanh trượt, preset, nút khóa vuông.
- Giao diện có hai ngôn ngữ: Tiếng Việt (mặc định) và English, qua một từ điển đơn giản.
- Cảm ứng và bàn phím: nút đủ lớn, có nhãn, thao tác bằng bàn phím được.
- Tuyệt đối không ghi bất kỳ trạng thái nào vào trình duyệt.

## 11. Kiểm thử và tiêu chí nghiệm thu

### Test tự động (Vitest)

1. Với 200 bộ từ ngẫu nhiên và nhiều seed: mọi từ được đặt đều tìm lại được đúng vị trí đã ghi; mọi hướng nằm trong tập hướng đang bật; kích thước lưới đúng; chữ lấp thuộc bảng chữ cho phép.
2. Cùng seed và đầu vào cho lưới giống hệt.
3. Preset Dễ: không từ nào đi ngược hay chéo.
4. 64×64 với 150 từ: đặt được ít nhất 98% từ, đúng ngân sách thời gian ở mục 8.
5. Kích thước tự động cho danh sách mẫu A và B nằm trong khoảng ở mục 8.
6. Scramble: cùng tập chữ với từ gốc, giữ ranh giới từ, khác từ gốc khi có thể, tuân thủ chế độ chữ đầu và chữ gợi ý.
7. Tiếng Việt: "Đà Nẵng" thành `DANANG` khi bỏ dấu; khi giữ dấu thì mỗi chữ có dấu là một ô và không bị tách dấu khi xáo.
8. Layout: mọi lệnh vẽ nằm trong lề; 20 từ ra 5 hàng × 4 cột, 10 từ ra các hàng 4, 4, 2; trang scramble gồm đủ 20 dòng.
9. Xuất: PNG A4 300 DPI đúng 2480×3508 px; số trang PDF bằng số trang đã chọn; in ra đúng một SVG mỗi tờ (kiểm tra bằng Playwright, tùy chọn).
10. Fixture (mục 13): bộ dò tìm thấy cả 10 từ mẫu B đúng vị trí đã liệt kê, và tìm thấy cả 20 từ mẫu A trong lưới mẫu A.

### Nghiệm thu bằng mắt

Với danh sách từ mẫu A, B, C, chụp màn hình bản của ta đặt cạnh ảnh render của PDF mẫu và gửi cho người dùng duyệt. Bố cục (thứ tự các khối, 4 cột danh sách, tỉ lệ lưới, đánh số scramble, ô gạch) phải khớp.

## 12. Các giai đoạn

**Giai đoạn 0, Khảo sát.** Dựng dự án Vite + TS + Vitest. Render 3 PDF mẫu thành ảnh, viết `reference/NOTES.md`. Dừng, báo cáo những gì quan sát được.

**Giai đoạn 1, Core.** `rng`, `text`, generator, solver, sizing, scramble, kèm test mục 11 (1–7, 10). Chạy được bằng một script dòng lệnh in lưới ra terminal. Xong khi test xanh.

**Giai đoạn 2, Layout và xem trước.** `DrawOp`, layout Word Search (đề, đáp án) và Scramble, renderer SVG. Một trang HTML tạm hiển thị 3 mẫu để so với PDF. Xong khi người dùng duyệt ảnh chụp.

**Giai đoạn 3, Giao diện và xuất file.** UI đầy đủ, worker, in, PNG, PDF (ảnh nhúng), chia sẻ, i18n. Xong khi chạy tốt trên Chrome/Safari/Firefox, iPad, điện thoại, và đạt test 8–9.

**Giai đoạn 4, Mở rộng (làm sau khi người dùng đồng ý).**
- Chế độ gợi ý: danh sách hiện clue thay cho từ (word search và scramble).
- In nhiều bản khác nhau cùng lúc (mỗi bản một seed, ví dụ mỗi học sinh một đề).
- PDF vector với font nhúng.
- PWA để dùng offline (chỉ cache mã nguồn, không cache dữ liệu người dùng).

## 13. Dữ liệu mẫu cho test (fixture)

Mẫu B, lưới 10×10 (10 hàng):

```
FVDVANZEAT
VVLFYBROOM
BTYPETRICK
LRJHQRWSHC
AEXCATDGEA
CAJPGHOSTN
KTBATBWAFD
SHQLWITCHY
KQAAORANGE
UWCMCAEJEX
```

Vị trí đúng (hàng, cột đánh số từ 1; ô đầu của từ): BROOM (2,6) →; TRICK (3,6) →; CAT (5,4) →; GHOST (6,5) →; BAT (7,3) →; WITCH (8,5) →; ORANGE (9,5) →; BLACK (3,1) ↓; TREAT (3,2) ↓; CANDY (4,10) ↓.

Mẫu A, lưới 20×20 (20 hàng). Bộ dò phải tìm thấy mỗi từ ở ít nhất một vị trí, theo 8 hướng, với `JACKOLANTERN` là chuỗi của "Jack O Lantern":

```
QAMUMMYEXZFBPLVDFTAC
NUJEPZGPBNHCTIWBLFEG
KNYQYPVQQZUJTYXLESEP
TODAKYFMHWKGRLXWSJRN
KIWJZNNLWISNEXAEAQYR
HKCOLRAWABSEAQXCCTPK
LLZVOBLACKEQTXKMNGAI
HBMQJPPJIOEIZOORGOOL
ACAULDRONMYILRSHABDY
ROILHKCVUWYAAWOSALVM
GHVFLUATWSNNJSBQMIZM
MNVHJMSYITGSTKQWTNEO
DJPYPOGNEEWOLLAHDEVN
IXTICKYRPGCTVXWDJMCS
YYRYDZNJITRUOXBJGORT
XELULZZSEOROYRWZYRVE
JSBZWYYDNACIOCJSZYCR
CDOCNXRZOJYOCJHTVQAH
IAWEYEIGMFMDFKOAQBYJ
OAFLOWEREWKOFFABEKAU
```

Nếu một từ không tìm thấy, so lại với PDF mẫu A trước khi nghi ngờ bộ dò (có thể chép sai).

Scramble mẫu C: dùng làm kiểm tra bố cục (số dòng, số gạch, thứ tự), không dùng làm kỳ vọng cho kết quả xáo vì xáo là ngẫu nhiên.

## 14. Prompt khởi động

```
Đọc SPEC.md trong thư mục này. Thực hiện Giai đoạn 0 rồi dừng lại báo cáo, đừng sang giai đoạn sau khi chưa được đồng ý.

Quy tắc làm việc:
- Làm lần lượt từng giai đoạn trong mục 12; mỗi giai đoạn xong thì chạy test, tóm tắt kết quả và (từ Giai đoạn 2) gửi ảnh chụp màn hình để tôi duyệt.
- Không thêm tính năng ngoài SPEC. Nếu SPEC mâu thuẫn hoặc thiếu thông tin, hỏi tôi ngắn gọn.
- Không lưu bất kỳ dữ liệu người dùng nào vào trình duyệt.
- Không dùng tên hay logo "Qualint" hoặc "Wordsheets" trong sản phẩm.
- Ưu tiên ít thư viện, mã dễ đọc, hàm thuần cho core và layout.
```
