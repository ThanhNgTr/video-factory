# KẾ HOẠCH PHÁT TRIỂN: NHÀ MÁY VIDEO HÌNH KHỐI 3D TỰ VẬN HÀNH

Bản đầu: 12/11/2026 · Cập nhật: 13/11/2026 (chuyển sang phong cách 3D khối, thêm định dạng series có lời dẫn, ngôn ngữ mặc định tiếng Anh)

## 1. Mục tiêu

Tạo hàng loạt video ngắn theo dạng đã viral, lắp ráp như các module.

- Đầu vào: kịch bản (từ video viral, có sẵn, hoặc đi spy).
- Claude tự viết kịch bản và dựng phim bằng **nhân vật khối 3D low-poly**, tô màu phẳng kiểu hoạt hình (toon). Không dùng model AI video.
- Có thư viện nhân vật dùng chung để giữ đồng nhất, gồm nhiều thể loại nhân vật.
- Đưa video viral vào, hệ thống học thành thư viện của mình, sửa lại rồi đẻ nhiều phiên bản.
- **Gần như 100% do AI làm.** Con người chỉ góp ý tưởng hoặc sửa kịch bản. Con người không can thiệp vào bước dựng phim.

Hai định dạng video:
- **Skit ngắn** (18–35 giây): hội thoại giữa nhân vật, hook trong 2 giây đầu, twist, đoạn cuối nối vòng về đầu.
- **Series có lời dẫn** (khoảng 2 phút mỗi tập), theo mẫu sếp gửi:
  - Người dẫn chuyện nói với "bạn", người xem là nhân vật chính.
  - Có HUD kiểu game: đêm, giờ, bộ đếm.
  - Phụ đề lớn, tô vàng từ khóa.
  - Có luật sinh tồn đánh số, sau đó từng luật bị thử thách.
  - Cuối tập hù dọa, kết bằng "bình luận 1 hay 2", tập sau đi theo lựa chọn của khán giả.


## 2. Hiện trạng (đến 13/11/2026)

Giai đoạn 0 đã xong với bản dựng 2D, trong thư mục `video-factory/`. Mọi khâu đều đã chạy thật:

| Khâu | Trạng thái | Đã kiểm chứng |
|---|---|---|
| Ingest (link → công thức) | Chạy | Học 2 video thật: 1 short YouTube và video mẫu trên X của sếp. Mỗi video mất khoảng 45–90 giây |
| Viết kịch bản | Chạy | Claude tự viết, sai cấu trúc thì tự sửa lại |
| Giọng đọc | Chạy | edge-tts (giọng Anh và Việt; tự đổi giọng nhân vật theo ngôn ngữ của video), dự phòng bằng gTTS |
| Dựng hình 2D | Chạy | Đã ra 4 video: skit 33 giây; tập 1 và tập 2 của series "Ca Đêm"; 1 video thử |
| Series nhiều tập | Chạy | Tập 2 tự nối đúng mạch tập 1 (nhân vật, đồng hồ, luật, lựa chọn của khán giả) |
| Thư viện | 12 nhân vật, 23 hành động, 7 bối cảnh, 2 công thức | Phần nhân vật, hành động, bối cảnh sẽ chuyển sang 3D |
| Thử phong cách 3D | Đã có bản thử | Đoạn 3 giây ở cửa hàng đêm, 2 nhân vật khối, khớp phong cách mẫu |

Chi phí Claude đo được thực tế:
- Skit: khoảng $0,10 mỗi video.
- Tập series: khoảng $0,25–0,50 mỗi tập.
- Học một video viral: khoảng $0,26.

**Quyết định mới:** chuyển phần dựng hình sang 3D. Pipeline, giọng đọc, chế độ series, HUD và phụ đề giữ nguyên.


## 3. Ý tưởng cốt lõi

Video được lưu dưới dạng **dữ liệu (JSON)**, không phải pixel. Claude chỉ viết dữ liệu: ai xuất hiện, ở đâu, làm gì, nói gì, camera đặt ở đâu, trong bao lâu. Một chương trình dựng hình viết sẵn biến dữ liệu đó thành MP4.

- Nhân vật được lắp từ khối 3D (hộp bo góc, trụ, cầu) bằng code, nên lần nào cũng giống hệt nhau.
- Muốn ra 100 phiên bản thì chỉ cần đổi tham số.
- Hành động, bối cảnh, ánh sáng và góc máy cũng là dữ liệu. Nhờ vậy AI tự mở rộng được thư viện mà không cần lập trình viên, và không phải chạy code do AI tự sinh.


## 4. Vai trò của con người

Chỉ có 2 việc, cả hai đều không bắt buộc:
1. Thả ý tưởng hoặc kịch bản vào "hộp ý tưởng". Với series, đây là nơi ghi lựa chọn khán giả đã bình chọn.
2. Sửa kịch bản Claude viết trước khi đưa đi dựng.

Mọi bước còn lại đều do máy làm. Hộp ý tưởng trống thì hệ thống tự chạy dựa trên công thức viral.


## 5. Kiến trúc: 5 module

Mỗi công việc là một module trong `video-factory/modules/`, có hợp đồng dữ liệu riêng (`schema.ts`). `make.ts` là dây chuyền gọi lần lượt từng module. Chi tiết file: xem README.

```
 [Video viral / link spy]
          │
   ① KỊCH BẢN (script) ── học công thức viral ──► library/formulas
          │                     ▲
          │              FEEDBACK (view thật → chấm điểm công thức) — chưa làm
          ▼
   công thức + ý tưởng + thư viện (+ tóm tắt các tập trước) ─► scene.json
          │
   ② NHÂN VẬT (character) ─ người khối 3D + hành động; nhân vật mới vào library/people
   ③ BỐI CẢNH (set) ─────── phòng + đạo cụ khối 3D từ library/sets
   ④ GIỌNG ĐỌC (voice) ──── mỗi câu thoại một mp3 (edge-tts, dự phòng gTTS)
   ⑤ SẢN XUẤT VIDEO (video) ─ dòng thời gian + render 3D ─► MP4 ─► QA tự động ─► đăng tự động
```

| Module | Làm gì | Công cụ |
|---|---|---|
| ① Kịch bản | Tải video, tách lời, lấy tối đa 40 khung hình, Claude rút ra công thức. Từ công thức + ý tưởng + thư viện, Claude viết scene.json, sai thì tự sửa | yt-dlp, ffmpeg, faster-whisper, Claude, zod |
| ② Nhân vật | Một bộ dựng đọc mọi file nhân vật JSON; Claude thêm nhân vật mới khi kịch bản cần | Three.js |
| ③ Bối cảnh | Một bộ dựng đọc mọi file bối cảnh JSON | Three.js |
| ④ Giọng đọc | Giọng riêng cho từng nhân vật và người dẫn, đổi theo ngôn ngữ video | edge-tts, gTTS, ffmpeg |
| ⑤ Sản xuất video | Ghép cảnh, camera, ánh sáng, HUD, phụ đề tô từ khóa, nhép miệng, xuất MP4 9:16 | Remotion + Three.js |

Thư viện (`library/`) là kho JSON dùng chung, lưu lịch sử bằng git, chưa cần database.


## 6. Các "linh kiện" lắp ráp (đều là dữ liệu)

### 6.1 Nhân vật 3D: `people/ong-lao.json`

Chỉ có một bộ dựng 3D đọc mọi file nhân vật. Thêm thể loại mới chỉ cần thêm file JSON. Thể loại gồm: người (học sinh, nhân viên, ông lão...), động vật, đồ vật, quái vật/fantasy.

```json
{ "id": "ong-lao", "name": "Ông Lão", "genre": "nguoi",
  "build": { "height": 1.0, "head": 1.0, "body": "slim" },
  "skin": "#e8b48f",
  "hair": { "style": "bald-sides", "color": "#e9e9e9" },
  "face": { "eyes": "dot", "brows": "bushy", "mustache": true },
  "outfit": { "top": "coat", "topColor": "#3b4152", "pants": "#2a2f3a" },
  "wear": ["top-hat", "scarf"],
  "voice": { "id": "en-US-GuyNeural", "pitch": "-10Hz", "rate": "-5%" },
  "personality": "điềm tĩnh, nói ít, biết nhiều hơn những gì ông kể" }
```

Claude viết bộ luật phong cách một lần: tỉ lệ đầu/thân, độ bo góc, bảng màu, kiểu mắt. Từ đó, mọi nhân vật mới đều theo luật này. Mỗi nhân vật mới được render thử một tấm từ nhiều góc. Claude tự kiểm tra xem nhân vật có dễ nhận ra và có khác các nhân vật đã có không, rồi mới nhập vào thư viện.

### 6.2 Hành động: `actions/quay-dau.json`

Mỗi hành động là chuỗi góc xoay của các khớp (đầu, thân, tay, chân) theo thời gian. Claude viết thêm hành động mới thì cũng chỉ là viết thêm JSON.

```json
{ "id": "quay-dau", "dur": 0.8, "loop": false,
  "keys": [
    { "t": 0,   "head": [0, 0, 0] },
    { "t": 0.6, "head": [0, 70, 0], "face": "shock" },
    { "t": 1,   "head": [0, 65, 0], "spine": [5, 10, 0] } ] }
```

Khoảng 20 hành động khởi đầu: đứng, đi, chạy, ngồi, đứng dậy, quay đầu, nhìn quanh, nói, gật/lắc đầu, chỉ tay, giơ tay, run sợ, giật mình, ngã, cầm điện thoại, đưa giấy, cúi chào, thì thầm, nhảy dựng lên...

### 6.3 Bối cảnh 3D: `sets/cua-hang-dem.json`

Ghép từ các khối cơ bản và các "đồ dựng sẵn" như kệ hàng, ghế, quầy, cửa, cột, đèn trần. Mỗi bối cảnh có ánh sáng và sương riêng.

```json
{ "id": "cua-hang-dem", "room": [8, 4, 8], "wall": "#c9d3dd", "floor": "#8b93a8",
  "props": [ { "type": "shelf", "pos": [0, 0, -2.5], "w": 3.8 },
             { "type": "counter", "pos": [0.75, 0, 0], "w": 1.3 },
             { "type": "ceiling-light", "pos": [-1, 3.4, -0.6] } ],
  "light": "night", "fog": [6, 15] }
```

- **Góc máy:** toàn cảnh, trung cảnh, cận mặt, qua vai, đẩy chậm (push), trượt (dolly), lia (pan), rung (shake).
- **Ánh sáng:** ngày, đêm, kinh dị, đèn chớp tắt (flicker), tắt dần từng dãy đèn.

### 6.4 Công thức viral: `formulas/*.json`

Được rút ra từ video gốc. Hệ thống chỉ học **cơ chế và cấu trúc**, không chép câu chuyện, lời thoại, nhân vật hay bối cảnh của video gốc. Ví dụ công thức đã học được từ video mẫu của sếp, `second-person-rules-horror-choice-cliffhanger` (dài 120 giây):

```
0–4s    hook    lời dẫn ngôi "bạn", tựa đề + "Phần 1", HUD giờ + bộ đếm
4–53s   setup   không khí lạ → người bí ẩn xuất hiện → đưa 3 luật sinh tồn đánh số
53–94s  twist   người giúp đỡ biết tên "bạn" → đèn tắt dần → "người thân" gọi điện thử luật 3
94–114s payoff  cửa mở ra bóng tối → hù dọa
114–120s cta    "Phần 2?" — bình luận 1 hay 2, số đông quyết định tập sau
```

### 6.5 Kịch bản dựng: `scene.json`

```json
{ "title": "Night Shift 24h – Part 1", "set": "cua-hang-dem", "mood": "night",
  "hud": { "title": "Night 1 · Shift", "counterLabel": "Customers" },
  "shots": [
    { "camera": "push", "text": "Tonight, *never* say your name.", "clock": "23:58", "counter": 0,
      "cast": [], "line": { "who": "narrator", "text": "If you can hear this, your *shift* has already started." } },
    { "camera": "closeup", "focus": "ong-lao",
      "cast": [{ "id": "ong-lao", "pos": [-0.5, 0], "action": "quay-dau", "face": "smug" }],
      "line": { "who": "ong-lao", "text": "You never told me your name... *did you*?" } } ],
  "summary": "Tóm tắt + cliffhanger, để tập sau nối tiếp." }
```


## 7. Hai vòng lặp tự học

```
 VÒNG A — HỌC TỪ VIRAL (chạy định kỳ mỗi ngày)
 nguồn spy ─► ① Ingest ─► rút công thức ─► thiếu linh kiện? ─có─► Claude tạo JSON mới
                                               │                 ─► render thử ─► QA
                                               ▼                 ─► đạt: nhập thư viện
                                           THƯ VIỆN

 VÒNG B — HỌC TỪ KẾT QUẢ CỦA CHÍNH MÌNH
 chọn công thức ─► Claude viết kịch bản ─► [người sửa nếu muốn] ─► biến thể ×N
   ▲                                                                  │
   │                                                     render ─► QA tự động
   │                                                                  │ đạt
 chấm điểm ◄── kéo view/retention + đếm bình chọn 1/2 ◄── đăng tự động ◄┘
 + viết "bài học"
```

Vòng B học theo 2 tầng:
1. **Chấm điểm công thức theo số liệu.** Khoảng 80% sản lượng dùng các công thức đang thắng. Khoảng 20% dành để thử công thức mới.
2. **Claude tự rút bài học.** Mỗi tuần, Claude so sánh nhóm video top với nhóm video đáy rồi ghi vào `lessons.md`. Lần viết kịch bản sau, Claude đọc file này.

Riêng với series: hệ thống đếm bình luận "1"/"2" của tập trước để chọn hướng cho tập sau. Cho đến khi có API đếm tự động, con người ghi kết quả bình chọn vào hộp ý tưởng.


## 8. Đẻ nhiều phiên bản

Các phiên bản phải khác nhau thật sự. Có các "núm vặn" sau:
- Dàn nhân vật hoặc thể loại
- Bối cảnh, ánh sáng, bảng màu
- Câu hook (Claude viết 5 hook cho cùng một phần thân)
- Twist, đoạn kết, hoặc lựa chọn 1/2
- Ngôn ngữ và giọng đọc

Ví dụ: 1 công thức × 4 dàn nhân vật × 5 hook × 2 đoạn kết = 40 video. Với series: 1 thế giới (luật + nhân vật) đẻ ra nhiều series song song ở các bối cảnh khác nhau.


## 9. QA tự động (thay người duyệt)

Sau khi render, hệ thống lấy khoảng 1 khung hình mỗi giây và cho Claude xem để chấm theo checklist:
- Nhân vật không bị cắt khỏi khung, không đâm xuyên vào nhau hay vào đồ vật
- Mặt nhân vật được chiếu sáng đủ trong cảnh tối
- Phụ đề đọc được, không đè lên HUD hay mặt nhân vật
- Hành động khớp với lời thoại
- Hook xuất hiện trước giây thứ 2 (series: trước giây thứ 3)

Video không đạt thì Claude sửa scene.json rồi render lại, tối đa 2 lần. Vẫn không đạt thì bỏ và ghi log.

Hệ thống cũng so độ giống giữa các biến thể. Bản nào quá giống bản đã đăng thì bị bỏ.

Công tắc dừng tự động: khi tài khoản bị cảnh báo hoặc reach giảm mạnh, hệ thống tự ngừng đăng.


## 10. Công nghệ

- **Dựng hình:** TypeScript + Remotion + Three.js (`@remotion/three`). Nhân vật, cảnh và ánh sáng là 3D thật. Chữ, HUD và phụ đề là lớp 2D phủ lên. Remotion miễn phí cho cá nhân và công ty từ 3 người trở xuống, công ty đông hơn phải mua license.
- **Claude:**
  - Opus 5.5 để phân tích video viral và viết tập series (cần sâu).
  - Sonnet 5.5 cho skit, biến thể và chấm QA (cần nhanh, rẻ).
  - Hiện gọi qua Claude Code CLI bằng tài khoản đang đăng nhập. Khi chạy số lượng lớn, chuyển sang API key riêng.
- **Ingest:** yt-dlp, ffmpeg, faster-whisper.
- **Giọng đọc (TTS):**
  - Hiện dùng edge-tts (khóa ở bản 7.2.3, vì bản mới bị lỗi với tiếng Việt), dự phòng bằng gTTS. Cả hai đều miễn phí nhưng không chính thức.
  - Video tiếng Anh: giọng của từng nhân vật tự đổi sang giọng Anh cùng giới tính, giữ nguyên cao độ và tốc độ.
  - Trước khi chạy số lượng lớn, chuyển sang ElevenLabs (tốt cho tiếng Anh; nếu làm tiếng Việt thì thêm FPT.AI).
- **Đăng bài và lấy số liệu:** TikTok Content Posting API, YouTube Data API, YouTube Analytics API.
- **Lưu trữ:** thư mục JSON trong git.

**Tốc độ render** (đo trên máy hiện tại, 12 nhân CPU, không có GPU cho WebGL):
- 2D: một tập 2 phút mất khoảng 3–4 phút.
- 3D: một tập 2 phút mất khoảng 10–12 phút (đo từ đoạn thử 3 giây).
- 50 tập 2 phút mỗi ngày cần khoảng 10 giờ render, nên phải có thêm máy hoặc máy có GPU.

**Cố ý chưa làm:**
- Model AI video.
- Rig xương mềm (skinned mesh): nhân vật khối chỉ cần khớp xoay.
- Nhập model 3D dựng tay (.glb). Đây là phương án để nâng chất lượng sau này nếu cần.
- Dashboard.


## 11. Lộ trình

| Giai đoạn | Thời gian | Kết quả |
|---|---|---|
| 0. Thử nghiệm không chạm tay (2D) | **Xong** | Từ link viral ra MP4 tự động; chế độ series; ingest video mẫu của sếp; bản thử 3D |
| 0.5. Chuyển bộ dựng sang 3D | 2–3 ngày | Bộ dựng nhân vật khối từ JSON; khoảng 20 hành động dạng khớp xoay; 5–6 bối cảnh 3D (cửa hàng đêm, xe buýt đêm, hành lang, lớp học, nhà, đường phố); preset góc máy và ánh sáng; chuyển nhân vật hiện có sang 3D; công cụ xem trước dạng ảnh ghép. Render lại tập 1–2 "Ca Đêm" bằng 3D để so sánh |
| 1. Thư viện tự sinh | 1–2 tuần | Claude tự tạo nhân vật, bối cảnh, hành động mới theo bộ luật phong cách, tự render thử và tự kiểm tra trước khi nhập thư viện |
| 2. QA tự động | 1–2 tuần | Vòng kiểm tra → sửa → render lại, kèm bước lọc biến thể trùng |
| 3. Vòng A (học từ viral) | 2 tuần | Chạy ingest định kỳ, phát hiện chỗ thiếu trong thư viện, tự lấp |
| 4. Biến thể + đăng tự động | 2 tuần | Hàng đợi render (nhiều máy hoặc GPU), đăng tự động lên TikTok/YouTube/Reels |
| 5. Vòng B (học từ kết quả) | 2 tuần | Kéo số liệu, đếm bình chọn 1/2, chấm điểm công thức, file bài học hằng tuần |

**Tổng thời gian còn lại:** khoảng 8–10 tuần với 1 dev. Không cần người thiết kế.

Chỉ số theo dõi: phút render cho mỗi video, chi phí API cho mỗi video, tỷ lệ video qua QA, số video mỗi ngày, view và retention trung bình theo từng công thức, tỷ lệ người xem từ tập trước sang tập sau của series.


## 12. Rủi ro

1. **Chính sách nền tảng:** YouTube (chính sách "inauthentic content") và TikTok có thể giảm reach hoặc tắt kiếm tiền với nội dung sản xuất hàng loạt na ná nhau. Cách giảm rủi ro: biến thể phải khác thật, lọc bản trùng, không đăng dồn trên một kênh, có công tắc dừng tự động.
2. **Bản quyền:**
   - Chỉ học cơ chế, không làm lại series của người khác (ví dụ video mẫu "LINE 9").
   - Câu chuyện, nhân vật và bối cảnh phải là của mình.
   - Nhạc lấy từ nguồn có license.
3. **Điều khoản nền tảng:** tải video từ TikTok/YouTube/X có thể vi phạm điều khoản sử dụng. Chỉ nên dùng để phân tích nội bộ.
4. **TikTok API có kiểm duyệt app:** app chưa qua kiểm duyệt (audit) chỉ đăng được ở chế độ riêng tư. Nên nộp duyệt sớm.
5. **Tốc độ và chi phí render 3D:** chậm hơn 2D khoảng 3 lần. Muốn chạy số lượng lớn cần đầu tư thêm máy render.
6. **Chất lượng 3D có giới hạn:** khối sinh bằng code trông đơn giản hơn model dựng tay. Nếu cần nâng lên, có thể nhập vài model .glb làm thư viện gốc.
7. **TTS miễn phí không chính thức:** edge-tts và gTTS có thể bị chặn hoặc đổi bất kỳ lúc nào. Cần TTS trả phí trước khi chạy số lượng lớn.
8. **Vòng tự học có thể học sai:** khi dữ liệu còn ít, chấm điểm dễ bị nhiễu. Nên chờ mỗi công thức có tối thiểu 5–10 video rồi mới tin điểm số.


## 13. Đã chốt và còn cần chốt

**Đã chốt:**
- Phong cách: nhân vật khối 3D low-poly, tô màu phẳng kiểu hoạt hình.
- Có lồng tiếng: lời dẫn và giọng từng nhân vật, theo mẫu sếp gửi.
- Ngôn ngữ mặc định: **tiếng Anh**. Vẫn làm được tiếng Việt bằng `--lang "tiếng Việt"`.
- Có 2 định dạng: skit ngắn và series có lời dẫn theo mẫu sếp gửi.

**Còn cần chốt:**
- Có chấp nhận chế độ "không có ý tưởng thì máy vẫn tự chạy" từ công thức viral không? (hệ thống đã làm được)
- Đăng chủ yếu ở đâu: TikTok, YouTube Shorts hay Reels? (quyết định độ dài và nhịp)
- Bao nhiêu kênh, mỗi kênh đăng bao nhiêu video một ngày? (quyết định cần bao nhiêu máy render)
- Ngân sách cho: máy render (hoặc máy có GPU), API key Claude riêng, TTS trả phí.
- Ưu tiên series trước hay skit trước khi chuyển sang 3D?
