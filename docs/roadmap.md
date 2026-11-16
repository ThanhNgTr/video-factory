# ROADMAP XÂY MỚI: CÔNG XƯỞNG VIDEO HÌNH KHỐI 3D

Ngày lập: 16/11/2026 · Cập nhật 16/11/2026: thêm kiến trúc chi tiết (mục 4.7–4.13) và quy ước clean code (mục 6); nội dung video chỉ làm bằng tiếng Anh

Bản demo ở `~/Project/my-idea/video-factory` (nhánh `demo-3d`, commit `f79948d`; khoảng 1.400 dòng, viết trong 2 ngày) chỉ dùng để chứng minh tính khả thi. Roadmap này dành cho việc **viết lại hoàn toàn**. Từ demo chỉ giữ lại ý tưởng, dữ liệu thư viện và các con số đã đo được.

---

## 0. Tóm tắt

| Mốc | Thời điểm dự kiến | Có gì |
|---|---|---|
| Chốt quyết định + đo thử (spike) | 30/11/2026 | Đã chọn renderer, TTS, nền tảng đăng; đã nộp duyệt API |
| **MVP** | **cuối tháng 1/2027** (tuần 10) | Một lệnh ra một tập series hoàn chỉnh bằng tiếng Anh (kịch bản, hình 3D, giọng, nhạc, SFX). Đăng tay |
| Thử thị trường | tháng 2/2027 (có nghỉ Tết) | Đăng thật 3–5 tập/tuần, đo retention. **Điểm quyết định đi tiếp hay sửa định dạng** |
| v1: tự vận hành | cuối tháng 3/2027 | QA tự động, biến thể, đăng tự động, máy render GPU, cảnh báo |
| v2: tự học | khoảng tháng 5/2027 (đã tính dự phòng) | Học từ số liệu, đếm bình chọn, AI tự tạo linh kiện |

Hai điều quan trọng nhất của roadmap này:
1. **Có sản phẩm đăng được sớm (tuần 10), rồi mới tự động hoá.** Vòng tự học và đăng tự động chỉ đáng làm khi đã biết khán giả có xem.
2. **Rủi ro lớn nhất không nằm ở kỹ thuật.** Rủi ro lớn nhất là khán giả có xem hay không, và nền tảng có chấp nhận nội dung sản xuất hàng loạt hay không.

---

## 1. Giả định

Nếu một giả định sai, sửa bảng này trước. Các phần bên dưới tính theo bảng này.

| Mục | Giả định |
|---|---|
| Nhân lực | 1 dev toàn thời gian, có AI hỗ trợ viết code. Mỗi ngày khoảng 5 giờ code thực |
| Bắt đầu | 17/11/2026 |
| Định dạng ưu tiên | Series có lời dẫn, khoảng 2 phút mỗi tập. Skit làm sau |
| Ngôn ngữ | **Chỉ tiếng Anh (US English):** kịch bản, lời dẫn, lời thoại, chữ trên màn hình, tiêu đề và mô tả. Không làm tiếng Việt hay ngôn ngữ khác ở mọi mốc |
| Khán giả | Người xem nói tiếng Anh, chủ yếu ở Mỹ. Lịch đăng theo giờ Mỹ (là ban đêm ở Việt Nam) |
| Nền tảng đầu tiên | YouTube Shorts (API dễ xin nhất). TikTok nộp duyệt song song |
| Sản lượng mục tiêu | MVP: 3–5 tập/tuần · v1: khoảng 10 video/ngày · v2: khoảng 50 video/ngày |
| Vai trò con người | Đưa ý tưởng, sửa kịch bản. Giai đoạn thử thị trường: đăng tay (vì chưa có API đăng) |
| Ngân sách | Chưa chốt (xem mục 14) |

---

## 2. Bài học từ bản demo

### 2.1 Demo đã chứng minh được gì

| Câu hỏi | Kết quả demo | Ý nghĩa cho bản mới |
|---|---|---|
| Claude có viết được kịch bản đúng cấu trúc không? | Có. Viết sai schema thì Claude tự sửa khi được gửi lại lỗi. Tập series sau nối đúng mạch tập trước | Giữ vòng "kiểm tra, gửi lỗi lại, Claude sửa", nhưng chuyển sang structured output |
| Có rút được công thức từ video viral không? | Có. Mỗi video mất 45–90 giây, tốn khoảng $0,26 | Giữ cách làm, nâng cấp phần tách lời và tách cảnh |
| Có dựng được người khối 3D từ JSON không? | Có, nhưng chỉ chạy được bằng CPU (`--gl=swangle`). `angle` (GPU) lỗi trên máy này. Render quá 4 luồng song song thì Chrome crash vì máy chỉ có 14 GB RAM | Phải đo render bằng GPU trước khi chọn máy (spike S1) |
| TTS miễn phí có đủ dùng không? | Đủ để thử. edge-tts 7.3.x lỗi tiếng Việt nên phải khoá ở bản 7.2.3 | Không dựa vào TTS miễn phí trong bản thật |
| Chi phí Claude | Skit khoảng $0,10. Tập series $0,25–0,50 | Làm mốc ngân sách |
| Tốc độ render | 2D: 3–4 phút mỗi tập 2 phút. 3D: ước tính 10–12 phút mỗi tập (trên CPU) | Render là nút thắt khi tăng sản lượng |

### 2.2 Giữ lại gì

- **Nguyên tắc "video là dữ liệu":** Claude chỉ viết JSON, còn bộ dựng viết sẵn biến JSON thành MP4. Không dùng model AI tạo video.
- **Dữ liệu thư viện:** 5 nhân vật, 23 hành động, 2 bối cảnh, 2 công thức, 1 series (đã chép vào `legacy/library/`). Viết script chuyển chúng sang schema mới, không làm tay.
- **Luật viết series** trong prompt của demo: luật sinh tồn, HUD, phụ đề tô từ khoá, kết bằng lựa chọn 1/2 (đã chép vào `legacy/prompts/demo-prompts.md`). Dùng làm điểm khởi đầu.
- **Kiểm tra tham chiếu:** mọi id nhân vật, hành động, bối cảnh mà kịch bản dùng phải có trong thư viện.
- **Tóm tắt tập trước** để nối mạch series.

### 2.3 Làm lại gì

| Demo | Vấn đề | Bản mới |
|---|---|---|
| Gọi Claude qua Claude Code CLI, tách JSON bằng regex | Khó đo chi phí, không có batch, không kiểm soát được rate limit | Claude API (SDK) + structured output, prompt caching, Batch API |
| Một bước LLM viết thẳng `scene.json` | Người khó sửa. Claude phải lo cả truyện lẫn dàn dựng trong một lần | Tách 2 bước: **viết truyện** (`script.json`, người sửa ở đây) rồi **dàn dựng** (`scene.json`) |
| Claude tự đặt toạ độ x từ 0 đến 1 | Nhân vật đè nhau, góc máy khó kiểm soát | Mỗi bối cảnh có sẵn các vị trí đứng được đặt tên (`spots`). Góc máy gắn theo spot |
| `make.ts` chạy cả dây chuyền trong một lần | Không chạy lại riêng từng bước. Lỗi giữa chừng là mất hết | Orchestrator chạy theo từng bước (stage), cache theo hash đầu vào, chạy tiếp từ chỗ lỗi |
| Mỗi câu thoại một file mp3, không mix | Không có nhạc, không có SFX, âm lượng không đều. Phụ đề không chạy theo từng từ | Một track âm thanh: có mốc thời gian từng từ, nhạc, SFX, mix chuẩn LUFS |
| Audio ghi vào thư mục `public/` của Remotion | Dữ liệu của từng lần chạy lẫn vào mã nguồn | Kho artifact riêng; renderer đọc file qua đường dẫn |
| Luật định dạng viết cứng trong code prompt | Thêm định dạng mới phải sửa code | Định dạng là dữ liệu (`formats/*.json`). Prompt là file có version |
| Không có test, không log chi phí | Sửa một chỗ làm hỏng chỗ khác mà không biết | Contract test, golden frame, LLM eval, log chi phí mỗi lần chạy |
| Không có remote git | Mất máy là mất hết | Remote git riêng tư ngay từ ngày đầu |

---

## 3. Phạm vi theo mốc

| | MVP (tuần 10) | v1 (khoảng tuần 18) | v2 (khoảng tuần 22–25) |
|---|---|---|---|
| Định dạng | Series | + Skit | + định dạng học được từ viral |
| Ngôn ngữ | Tiếng Anh | Tiếng Anh | Tiếng Anh (không thêm ngôn ngữ khác) |
| Thư viện | 4 bối cảnh, khoảng 8 nhân vật, khoảng 25 hành động | 6 bối cảnh, 12 nhân vật | AI tự tạo linh kiện, có QA |
| Âm thanh | TTS trả phí, nhạc, SFX, mix | | |
| QA | Kiểm tra bằng luật (độ dài, khung đen, im lặng) | + vision QA, kiểm duyệt nội dung, tự sửa | |
| Biến thể | Không | Hook, đoạn kết, dàn nhân vật; lọc trùng | |
| Render | 1 máy | Máy GPU + hàng đợi | Nhiều máy |
| Đăng | Đăng tay | Tự động lên YouTube (+ TikTok nếu đã được duyệt) | Nhiều kênh |
| Học | Không | Không | Vòng A (học từ viral) + vòng B (học từ kết quả) |

**Cố ý không làm** ở mọi mốc: model AI tạo video, rig xương mềm, dashboard đẹp, microservice, Kubernetes.

---

## 4. Kiến trúc

### 4.1 Nguyên tắc

1. **Module là gói độc lập, có hợp đồng dữ liệu riêng.** Module không import lẫn nhau, chỉ import gói `contracts`. Ngoại lệ duy nhất: module video dùng component 3D do module assets cung cấp.
2. **Mỗi bước là một hàm:** nhận file đầu vào và config, trả ra file đầu ra. Không đọc trạng thái toàn cục.
3. **Nhà cung cấp thay được:** LLM, TTS, nhạc, renderer và nền tảng đăng đều nằm sau một interface. Ví dụ đổi Azure sang ElevenLabs chỉ sửa một file.
4. **Dữ liệu trước, code sau:** linh kiện, định dạng, công thức và prompt đều là file có version.
5. **Mọi bước chạy lại được:** cache theo hash, chạy tiếp từ bước lỗi. Sửa một câu thoại thì chỉ đọc lại câu đó và render lại, không gọi lại Claude.
6. **Đơn giản trước:** file và SQLite, một tiến trình. Chỉ thêm Postgres, Redis hay cloud khi số đo bắt buộc phải thêm.

### 4.2 Sơ đồ

```
                 library/  (people · sets · props · actions · formats · formulas · music · sfx)
                                          │ đọc
 ┌──────── A. SCRIPT ────────┐  ┌─ B. ASSETS ─┐  ┌── C. AUDIO ──┐  ┌──── D. VIDEO ─────┐
 │ ingest → formula.json     │  │ kiểm tra    │  │ chuẩn hoá chữ│  │ timeline          │
 │ write  → script.json ◄ người│─►│ tham chiếu  │─►│ tts + mốc từ │─►│ render → mp4      │
 │ direct → scene.json       │  │ ảnh xem trước│  │ nhạc, sfx    │  │ qa → (sửa, render)│
 │ bible  → series-bible.json│  │ (v2: tự tạo)│  │ mix → wav    │  │ thumbnail         │
 └─────────────▲─────────────┘  └─────────────┘  └──────────────┘  └─────────┬─────────┘
               │                                                             │
               └──── metrics.json ◄── PUBLISH (đăng + kéo số liệu) ◄─────────┘

 packages/pipeline: chạy các bước, cache, thử lại, ghi trạng thái và chi phí vào SQLite
```

### 4.3 Cấu trúc repo

```
vf/
├─ packages/
│  ├─ contracts/   zod schema cho mọi artifact + xuất JSON Schema cho Claude
│  ├─ core/        LLM client (log chi phí, cache), kho artifact, logger, config, tiện ích ffmpeg
│  └─ pipeline/    stage, cache theo hash, trạng thái SQLite, chạy tiếp, worker
├─ modules/
│  ├─ script/      A: ingest, write, direct, bible; prompts/*.md
│  ├─ assets/      B: style guide, component 3D (Character, SetView, Prop), action engine, kiểm tra, xem trước
│  ├─ audio/       C: chuẩn hoá chữ, provider TTS, nhạc, sfx, mix
│  └─ video/       D: timeline, composition Remotion, overlay (HUD, phụ đề), QA
├─ services/
│  └─ publish/     đăng bài, lịch đăng, kéo số liệu (từ giai đoạn 6)
├─ apps/
│  ├─ cli/         lệnh `vf`
│  ├─ worker/      worker render (chạy trên máy GPU)
│  └─ studio/      Remotion Studio + trang xem thư viện
├─ tools/python/   whisperX, PySceneDetect (dự án uv riêng, giao tiếp bằng JSON)
├─ library/        dữ liệu linh kiện (JSON, có schemaVersion)
├─ evals/          bộ đề kiểm tra LLM, video mẫu có lỗi cho QA
└─ docs/adr/       quyết định kỹ thuật, mỗi quyết định một file
```

### 4.4 Hợp đồng dữ liệu

Mọi artifact đều có trường `schemaVersion`. Đổi schema thì phải có script chuyển dữ liệu cũ sang.

| Artifact | Bước tạo ra | Bước đọc | Nội dung chính |
|---|---|---|---|
| `formula.json` | A.ingest | A.write | Các nhịp truyện theo giây, kiểu hook, CTA, kỹ thuật giữ chân người xem |
| `series-bible.json` | A.bible (cập nhật sau mỗi tập) | A.write | Thế giới, luật, nhân vật, sự thật đã lộ, tóm tắt cuốn chiếu, lựa chọn khán giả đã bình chọn |
| `script.json` | A.write | **người sửa**, A.direct | Các nhịp truyện, lời thoại theo người nói, chữ trên màn hình, lựa chọn 1/2 |
| `scene.json` | A.direct | B, C, D | Từng shot: bối cảnh, spot, nhân vật + hành động + biểu cảm, góc máy, ánh sáng, cue SFX, HUD |
| `assets.json` | B.check | D | Danh sách linh kiện đã kiểm tra, ảnh xem trước |
| `audio.json` + file | C | D | Mỗi câu: file, độ dài, mốc từng từ. Nhạc, cue SFX, file `mix.wav`, độ to LUFS |
| `timeline.json` | D.timeline | D.render | Frame bắt đầu và kết thúc của mỗi shot, phụ đề theo từng từ |
| `video.mp4`, `thumb.jpg` | D.render | D.qa, publish | |
| `qa.json` | D.qa | pipeline | Đạt hay không, lỗi theo giây, đề xuất sửa |
| `publish.json`, `metrics.json` | publish | A (vòng học) | Id bài đăng, view, retention, bình chọn |

### 4.5 Một bước (stage) trông như thế nào

```ts
export const tts = stage({
  name: "audio.tts",
  version: 3,                          // đổi logic → tăng version → cache cũ tự hết hiệu lực
  inputs: ["scene.json"],
  outputs: ["audio.json"],
  run: async (ctx, { scene }) => { /* ... */ },
});
```

**Lệnh dự kiến:**
- `vf make --format series --series night-desk [--idea ...]`: chạy cả dây chuyền.
- `vf run audio.tts --run <id>`: chạy riêng một bước.
- `vf resume <id>`: chạy tiếp từ bước lỗi.
- `vf preview person <id>`: xem trước một nhân vật.
- `vf eval script`: chạy bộ đề kiểm tra LLM.

**Interface nhà cung cấp:**
- `LLM.json(schema, prompt, opts)`
- `TTS.speak(text, voice) → { file, words[] }`
- `Music.pick(mood, seconds)`
- `Publisher.upload(video, meta)`
- `Metrics.pull(postId)`

### 4.6 Orchestrator

- **Một lần chạy** là một chuỗi bước, theo định dạng video. Trạng thái lưu trong SQLite, gồm 3 bảng `runs`, `stages`, `costs`.
- **Khoá cache** = hash(tên bước + version + hash các file đầu vào + config).
- **Thử lại:** gọi nhà cung cấp qua mạng thì thử lại có giãn cách (backoff). Kết quả LLM sai schema thì gửi lại lỗi, tối đa 2 lần.
- **Worker:** từ giai đoạn 6, máy render là một worker riêng. Worker lấy việc từ bảng job, đọc và ghi file qua thư mục chia sẻ hoặc S3.
- **Log:** mỗi bước ghi một dòng JSON gồm thời gian, chi phí, nhà cung cấp và lỗi nếu có.

### 4.7 Kiểu kiến trúc: modular monolith + pipeline + ports & adapters

- **Modular monolith:** một repo, một codebase, các module tách bằng ranh giới trong code, không tách bằng mạng.
  - Lý do: chỉ có 1 dev và 1 lần deploy. Microservice sẽ thêm việc vận hành mà không đem lại gì.
  - Ngoại lệ: worker render chạy thành tiến trình riêng, có thể ở máy khác, vì nó nặng CPU/GPU. Nhưng nó vẫn dùng chung codebase và hợp đồng dữ liệu.
- **Pipeline:** mỗi video là một chuỗi bước. Mỗi bước đọc artifact và ghi artifact, các bước không gọi trực tiếp lẫn nhau. Thêm một bước mới là thêm một stage, không phải sửa các bước khác.
- **Ports & adapters (hexagonal) bên trong từng module:**
  - Logic nghiệp vụ không biết gì về SDK, file hay mạng.
  - Thứ cần từ bên ngoài (TTS, LLM, kho nhạc) được khai báo bằng một interface gọi là *port*.
  - Phần cài đặt cụ thể (Azure, ElevenLabs, ổ đĩa) gọi là *adapter*.

### 4.8 Cấu trúc bên trong một module

Ví dụ module âm thanh. Bốn module còn lại có cùng khung.

```
modules/audio/
├─ src/
│  ├─ domain/          logic thuần: không I/O, không SDK, không đọc process.env
│  │  ├─ normalize.ts      "23:58" → "eleven fifty-eight", "Rule #3" → "rule number three"
│  │  ├─ ducking.ts        tính đoạn nào phải giảm nhạc theo mốc giọng nói
│  │  └─ pick-music.ts     chọn bài theo không khí + độ dài
│  ├─ ports.ts         interface module cần: TtsProvider, MusicLibrary, SfxLibrary
│  ├─ adapters/        cài đặt port: azure-tts.ts, elevenlabs-tts.ts, fs-music-library.ts, fake-tts.ts
│  ├─ stages/          stage của pipeline: ghép domain + port, đọc và ghi artifact
│  │  ├─ tts.stage.ts
│  │  └─ mix.stage.ts
│  └─ index.ts         public API duy nhất của module: export stages, ports, types
├─ test/               unit test cho domain/, test stage với fake adapter
├─ README.md           trách nhiệm, input/output, cách chạy riêng, cách thay provider
└─ package.json        "exports" chỉ mở index.ts, nên không ai import sâu vào được
```

**Luật bên trong module:**

| Lớp | Được import | Không được làm |
|---|---|---|
| `domain/` | `contracts`, các file `domain/` khác | I/O, SDK, `fs`, `fetch`, `process.env`, `Date.now()`, `Math.random()` |
| `ports.ts` | `contracts` | Chứa code chạy được (chỉ có kiểu) |
| `adapters/` | `ports.ts`, SDK bên ngoài, `core` | Chứa logic nghiệp vụ |
| `stages/` | `domain/`, `ports.ts`, `core`, `pipeline` (kiểu `stage`) | Import trực tiếp một adapter cụ thể (adapter được truyền vào qua `ctx`) |

**Composition root:** adapter được chọn và lắp vào đúng một chỗ, là `apps/cli/src/wiring.ts` (và `apps/worker` tương tự), dựa theo config. Không dùng DI container, chỉ truyền tham số. Nhờ vậy test chỉ cần truyền `FakeTts`, `FakeLlm` vào là chạy được cả dây chuyền mà không tốn tiền.

### 4.9 Luật phụ thuộc giữa các gói

```
            contracts  (chỉ phụ thuộc zod)
               ▲
             core      (LLM client, store, logger, config)
               ▲
           pipeline    (stage, cache, trạng thái)
               ▲
   ┌───────┬───┴────┬──────────┐
 script  assets   audio      video ──► assets/render (ngoại lệ duy nhất)
   ▲       ▲        ▲          ▲
   └───────┴────┬───┴──────────┘        services/publish ──► contracts, core
               apps/*  (cli, worker, studio: composition root, được import mọi thứ)
```

**Bị cấm:**
- Module import module, trừ `video` → `assets/render`.
- Import sâu kiểu `@vf/audio/src/...`.
- Vòng phụ thuộc.
- `domain/` import `adapters/`.
- `packages/*` import `modules/*`.

**Ép buộc bằng công cụ, không bằng lời hứa:**
- dependency-cruiser chạy trong CI. Vi phạm luật nào thì build đỏ.
- Trường `exports` trong `package.json` chặn import sâu.

### 4.10 Ranh giới tin cậy và luồng dữ liệu

- **Validate ở ranh giới, tin ở bên trong.** Mọi dữ liệu đi vào từ bên ngoài đều phải `parse` bằng zod tại chỗ đi vào:
  - output của LLM;
  - file JSON trong `library/`;
  - `script.json` sau khi người sửa;
  - phản hồi từ API (TTS, YouTube, TikTok);
  - config.

  Bên trong module thì dùng kiểu TypeScript, không validate lại.
- **Artifact bất biến:** một bước không sửa file của bước khác. Khi người sửa `script.json`, hash của nó đổi, nên các bước phía sau tự chạy lại. Bước `video.fix` không ghi đè `scene.json` mà tạo bản sửa mới, và bản cũ được giữ lại để so.
- **Ghi file nguyên tử:** ghi ra file tạm rồi đổi tên. Bị ngắt giữa chừng thì không để lại file hỏng.
- **Đường dẫn:** stage chỉ biết tên artifact (`"audio.json"`). Kho artifact trong `core` quyết định file nằm ở đâu, trên ổ cục bộ hay S3.

### 4.11 Xử lý lỗi

| Loại lỗi | Ví dụ | Xử lý |
|---|---|---|
| Tạm thời | Mất mạng, rate limit, lỗi 5xx | Adapter tự thử lại có giãn cách (backoff + jitter), tối đa N lần. Vẫn lỗi thì ném `StageError { retryable: true }` |
| Dữ liệu | LLM trả sai schema, tham chiếu không có trong thư viện, QA không đạt | Vòng tự sửa: gửi lỗi lại cho Claude, tối đa 2 lần. Vẫn lỗi thì stage thất bại và ghi rõ lý do |
| Lập trình | Bất biến bị vi phạm, ví dụ shot có độ dài âm | Crash ngay, không bắt lỗi. Phải sửa code |

**Quy tắc:**
- **Một lớp lỗi chung** là `StageError { code, retryable, details }`.
- **Không nuốt lỗi:** `catch {}` rỗng bị lint cấm.
- **Thông báo lỗi phải đủ để sửa được:** tên bước, run id, hash đầu vào, và đoạn output gây lỗi.
- **Pipeline quyết định thử lại hay dừng dựa vào cờ `retryable`.** Stage không tự quyết định việc này.

### 4.12 Tính tất định (determinism)

- **Cùng đầu vào và cùng version thì cùng đầu ra.** Bước gọi LLM hoặc TTS không tất định, nhưng kết quả được cache nên từ lần thứ hai trở đi là tất định.
- **Code dựng hình là hàm thuần của `(props, frame)`:**
  - Không dùng `Math.random()` hay `Date.now()`.
  - Không giữ state giữa các frame.
  - Không fetch trong lúc render.

  Khi cần ngẫu nhiên (chớp mắt, đèn chớp), dùng `random(seed)` của Remotion, với seed lấy từ run id và id của shot.

  Lý do: Remotion render nhiều frame song song ở nhiều tab trình duyệt. Code phụ thuộc state sẽ cho ra hình khác nhau giữa các lần render, và golden test sẽ vô nghĩa.
- **Mỗi lần chạy có một seed,** được ghi vào trạng thái, để tái tạo lại đúng video đó.
- **Khoá phiên bản** bằng lockfile, Docker image (Chrome, ffmpeg, font) và version của model LLM.

### 4.13 Cấu hình, secret và khả năng quan sát

- **Config:**
  - Một file `vf.config.ts`, có schema zod, được đọc một lần ở composition root rồi truyền xuống.
  - Model, giọng, ngưỡng QA, giới hạn chi tiêu và độ phân giải đều nằm trong config, không viết cứng trong code.
  - Chỉ `core/config` được đọc `process.env`; lint chặn ở mọi chỗ khác.
- **Secret:** lấy từ biến môi trường (`.env` không commit, có `.env.example`). Không bao giờ ghi secret ra log hay artifact.
- **Log:**
  - Dùng logger có cấu trúc (pino). Mỗi dòng có `runId`, `stage` và `provider`.
  - Mỗi lần gọi LLM hoặc TTS ghi token, ký tự, chi phí và thời gian vào bảng `costs`.
- **Xem trạng thái:** `vf runs` (danh sách lần chạy) và `vf show <run>` (từng bước, thời gian, chi phí, lỗi, đường dẫn artifact). Chưa cần dashboard.

---

## 5. Chi tiết từng module

### A. Học và tạo kịch bản (`modules/script`)

| Bước | Làm gì |
|---|---|
| `script.ingest` | yt-dlp tải video. whisperX tách lời kèm mốc từng từ. PySceneDetect tìm điểm cắt cảnh và lấy khung hình tại đó. Claude (Opus) rút ra `formula.json` |
| `script.write` | Từ định dạng + công thức + series bible + ý tưởng + bài học, Claude viết `script.json` |
| `script.direct` | Từ `script.json` + tóm tắt thư viện, Claude viết `scene.json`. Kiểm tra tham chiếu, sai thì tự sửa |
| `script.review` | Claude đóng vai biên tập viên người Mỹ, đọc lại `script.json`. Kiểm tra: tiếng Anh tự nhiên, không lỗi ngữ pháp, đúng giọng kinh dị, câu ngắn dễ đọc to, không có chữ nào không phải tiếng Anh. Trả về danh sách sửa và tự áp dụng |
| `script.bible` | Sau mỗi tập: cập nhật series bible và tóm tắt cuốn chiếu |

- **Ngôn ngữ:**
  - Video nguồn đưa vào ingest có thể bằng bất kỳ ngôn ngữ nào, vì công thức chỉ là cơ chế.
  - Mọi thứ đầu ra đều là tiếng Anh: lời, chữ trên màn hình, tiêu đề, mô tả, hashtag.
  - Schema có kiểm tra bổ sung: chặn ký tự ngoài bảng chữ Latin cơ bản, ví dụ dấu tiếng Việt.
- **Kiểm thử:** bộ đề khoảng 20 trường hợp trong `evals/script`. Đo 4 thứ:
  - tỉ lệ hợp lệ ngay lần đầu;
  - tỉ lệ tuân thủ luật (hook dưới 3 giây, tổng lời dưới 1.300 ký tự, có 2–4 luật sinh tồn, kết bằng lựa chọn);
  - chi phí;
  - độ giống giữa các lần chạy.

  Chạy lại bộ đề mỗi khi sửa prompt.
- **Khó khăn thực tế:**
  - Claude viết na ná nhau. Cách xử lý: đưa danh sách hook và tiêu đề đã dùng vào prompt, và lọc trùng ở giai đoạn 5.
  - Công thức chép quá sát truyện gốc. Cách xử lý: tách rõ cơ chế với nội dung, và so độ giống với video gốc.
  - Series bible phình to qua nhiều tập. Cách xử lý: tóm tắt cuốn chiếu, giới hạn độ dài.

### B. Tạo nhân vật và bối cảnh (`modules/assets`)

| Phần | Làm gì |
|---|---|
| Style guide | Tỉ lệ đầu và thân, độ bo góc, bảng màu, kiểu mắt, viền. Claude viết, sếp duyệt một lần. Validator kiểm tra mọi nhân vật mới có theo style guide không |
| `<Character>` | Rig khớp xoay: hông, thân, cổ, đầu, vai, khuỷu, tay, háng, gối. Có hệ thống biểu cảm khuôn mặt, viseme cho miệng, điểm gắn đồ trên tay |
| Action engine | Keyframe + easing. Chuyển mượt giữa hai hành động. Lớp chuyển động nền khi đứng yên: thở, chớp mắt, lắc nhẹ |
| `<SetView>` | Phòng + đạo cụ + `spots` (vị trí đứng có tên và hướng nhìn) + bộ ánh sáng (ngày, đêm, kinh dị, đèn chớp, tắt dần) |
| `assets.check` | Mọi tham chiếu đều tồn tại, spot hợp lệ, không có hai nhân vật đứng cùng một spot |
| `assets.preview` | Ảnh ghép nhân vật từ 4 góc, ảnh bối cảnh từ 3 góc máy |
| `assets.generate` (v2) | Claude viết JSON linh kiện mới, render ảnh xem trước, vision QA. Đạt thì nhập thư viện |

- **Kiểm thử:** golden frame cho từng nhân vật và bối cảnh. Render một khung hình cố định rồi so pixel với ảnh chuẩn.
- **Khó khăn thực tế:**
  - Nhân vật khối dễ trông giống nhau. Mỗi nhân vật cần "chữ ký" riêng: dáng người, phụ kiện, màu chủ đạo.
  - Chuyển giữa các hành động dễ bị giật.
  - Khối sinh bằng code có thể trông quá đơn giản. Phương án: nhập đạo cụ `.glb` CC0.
  - Đây là phần tốn công nhất của dự án.

### C. Tạo âm thanh (`modules/audio`)

| Bước | Làm gì |
|---|---|
| `audio.normalize` | Đổi số, giờ, viết tắt sang chữ để đọc theo luật tiếng Anh ("23:58" → "eleven fifty-eight", "Rule #3" → "rule number three", "3AM" → "three A M"). Bỏ dấu đánh dấu từ khoá |
| `audio.tts` | Gọi nhà cung cấp TTS, chỉ dùng giọng en-US. Lấy mốc từng từ từ nhà cung cấp nếu có; nếu không thì căn lại bằng whisperX (model tiếng Anh). Cache theo từng câu (hash của chữ + giọng) |
| `audio.music` | Chọn bài theo không khí và độ dài, cắt hoặc lặp cho vừa |
| `audio.sfx` | Biến cue trong `scene.json` thành file SFX đặt đúng thời điểm |
| `audio.mix` | Giảm nhạc khi có giọng nói (ducking), chuẩn hoá khoảng -14 LUFS, true peak ≤ -1 dBTP, xuất `mix.wav` |

- **Kiểm thử:** đo độ to bằng ffmpeg `ebur128` và kiểm tra độ dài. Phát hiện TTS đọc thiếu chữ bằng cách cho whisper nghe lại rồi so với văn bản gốc.
- **Khó khăn thực tế:**
  - Giọng AI đọc đều đều, không hợp truyện kinh dị. Cần chỉnh khoảng ngừng, tốc độ và cảm xúc cho từng câu.
  - TTS đọc sai tên riêng.
  - Phải lưu bằng chứng license cho từng file nhạc và SFX.

### D. Tạo video thành phẩm (`modules/video`)

| Bước | Làm gì |
|---|---|
| `video.timeline` | Ghép `scene.json` với `audio.json` thành số frame cụ thể, và phụ đề hiện theo từng từ |
| `video.render` | Remotion + React Three Fiber. Dùng GPU nếu có. Chia nhỏ để render song song |
| `video.thumb` | Chọn khung hình làm ảnh bìa, thêm chữ |
| `video.qa` | Kiểm tra bằng luật: độ dài, khung đen (ffmpeg `blackdetect`), im lặng (`silencedetect`), phụ đề có nằm trong vùng an toàn không (tính bằng hình học). Từ giai đoạn 5 thêm vision QA và kiểm duyệt nội dung |
| `video.fix` | Từ lỗi QA, Claude sửa `scene.json` rồi chạy lại từ bước dàn dựng hoặc render, tối đa 2 lần |

- **Kiểm thử:** golden frame cho overlay (HUD, phụ đề). Mỗi đêm chạy thử một video 5 giây từ đầu đến cuối.
- **Khó khăn thực tế:**
  - Render chậm.
  - Chrome crash khi thiếu RAM.
  - Vision QA chấm sai. Phải đo độ chính xác trên bộ video mẫu có lỗi biết trước.

### Dịch vụ đăng bài (`services/publish`, từ giai đoạn 6)

- Đăng bài lên YouTube, TikTok và Reels, có lịch đăng.
- Điền metadata: tiêu đề, mô tả, hashtag, ảnh bìa, nhãn nội dung AI, đánh dấu "không dành cho trẻ em".
- Lịch đăng theo giờ cao điểm của Mỹ (giờ ET/PT), nên phải chạy tự động vì đó là ban đêm ở Việt Nam.
- Có công tắc dừng.
- Kéo số liệu về, đếm bình luận "1"/"2".

---

## 6. Clean code: quy ước viết code

Mục tiêu: 6 tháng sau, bạn (hoặc một người mới) đọc bất kỳ module nào cũng hiểu trong 15 phút, và sửa một module không làm hỏng module khác.

### 6.1 TypeScript và công cụ

| Việc | Quy ước |
|---|---|
| `tsconfig` | `strict: true`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`. Chỉ dùng ESM |
| Kiểu | Cấm `any` (lint báo lỗi). Dữ liệu chưa rõ thì dùng `unknown`, rồi `parse` bằng zod. Kiểu lấy từ schema (`z.infer`), không viết hai lần |
| Lint + format | Biome: một công cụ làm cả hai việc, chạy nhanh. Format tự động khi lưu file; CI chặn nếu file chưa được format |
| Luật kiến trúc | dependency-cruiser theo mục 4.9, chạy trong CI |
| Dữ liệu bất biến | Kiểu `readonly` cho artifact và linh kiện. Muốn đổi thì tạo object mới, không sửa object cũ |
| Dependency | Chỉ thêm khi tự viết sẽ mất hơn nửa ngày. Khoá phiên bản bằng lockfile. Nâng phiên bản có chủ đích, mỗi lần một gói, chạy golden test sau khi nâng |

### 6.2 Đặt tên và tổ chức

- **Code, tên biến, comment, commit, tên file đều bằng tiếng Anh**, khớp với nội dung video. Tài liệu (`docs/`) có thể bằng tiếng Việt.
- **Ngôn ngữ chung (ubiquitous language):** `docs/glossary.md` định nghĩa các từ dùng chung: `Formula`, `Beat`, `Script`, `Scene`, `Shot`, `Spot`, `Cue`, `Run`, `Stage`, `Artifact`, `Port`, `Adapter`. Code dùng đúng những từ này, không đặt tên khác cho cùng một khái niệm.
- **Tên file** dùng kebab-case (`pick-music.ts`); component React dùng PascalCase (`Character.tsx`); stage có hậu tố `.stage.ts`; adapter đặt theo nhà cung cấp (`azure-tts.ts`).
- **Mỗi file một trách nhiệm.** Ngưỡng cảnh báo (không phải luật cứng): file khoảng 300 dòng, hàm khoảng 50 dòng. Vượt ngưỡng thì xem có nên tách không.
- **Hằng số có tên, nằm một chỗ:** `FPS`, `SPEECH_LEAD_FRAMES`, `TARGET_LUFS`. Không để số "ma thuật" rải rác trong code.

### 6.3 Hàm, side effect và abstraction

- **Ưu tiên hàm thuần.** Logic trong `domain/` là hàm nhận dữ liệu và trả dữ liệu, test được mà không cần mock.
- **Side effect chỉ ở rìa:** `adapters/` và `stages/`. Nhìn chữ ký hàm là biết hàm đó có I/O hay không.
- **Class chỉ dùng cho adapter** cần giữ client hoặc kết nối. Còn lại dùng hàm và object thường.
- **Không tạo abstraction "để sau".** Interface chỉ tạo khi có ít nhất 2 cài đặt, hoặc cần thay bằng bản giả khi test. Port cho TTS, LLM, nhạc và publisher đều đạt điều kiện này; các chỗ khác thì chưa cần.
- **Không có cờ boolean làm đổi hẳn hành vi hàm** (`render(x, true)`). Tách thành hai hàm có tên rõ ràng.
- **Async rõ ràng:** mọi hàm I/O đều `async` và được `await`. Không có promise bị bỏ rơi; lint bật `noFloatingPromises`.

### 6.4 Prompt là code

- Prompt nằm trong `modules/*/prompts/*.md`, có biến template rõ ràng. Không nối chuỗi prompt rải rác trong code như bản demo.
- Mỗi prompt có version. Đổi prompt hoặc đổi model thì phải chạy `vf eval`, và lưu kết quả để so với lần trước.
- Output của LLM luôn đi kèm schema (structured output), không bao giờ tách JSON bằng regex.
- Không đưa dữ liệu người dùng vào phần system prompt. Ý tưởng của người đi vào một khối riêng, có đánh dấu rõ ràng.

### 6.5 Comment và tài liệu

- **Comment giải thích *vì sao*, không lặp lại *làm gì*.**
  - Tốt: `// pinned: v7.3 drops audio for some phrases`
  - Thừa: `// loop over shots`
- **Đường tắt có giới hạn** ghi theo mẫu `// shortcut: <giới hạn>, <khi nào nâng cấp>` (giữ lại từ demo). Lệnh `grep shortcut:` sẽ cho ra danh sách nợ kỹ thuật.
- **Mỗi module có một `README.md` ngắn:** trách nhiệm, input/output, cách chạy riêng, cách thay nhà cung cấp.
- **ADR (`docs/adr/NNNN-ten.md`)** cho mỗi quyết định kiến trúc: bối cảnh, lựa chọn, lý do, hệ quả. Một ADR dài khoảng nửa trang.

### 6.6 Kiểm thử

Dùng Vitest. Fake adapter (`FakeLlm` trả fixture có sẵn, `FakeTts` tạo âm thanh im lặng đúng độ dài) giúp test cả dây chuyền mà không tốn tiền.

| Loại | Kiểm tra gì | Chạy khi nào |
|---|---|---|
| Unit | Logic trong `domain/`: chuẩn hoá chữ, tính timeline, ducking, chọn spot, chọn nhạc | Mỗi commit |
| Contract | Mọi file mẫu trong `fixtures/` và `library/` parse đúng schema; script chuyển schema chạy đúng | Mỗi commit |
| Stage | Stage chạy với fake adapter; kiểm tra cache, chạy tiếp, xử lý lỗi | Mỗi commit |
| Golden frame | Render một khung hình cố định của nhân vật, bối cảnh, overlay, rồi so pixel bằng pixelmatch | Mỗi PR đụng tới `assets/` hoặc `video/` |
| Smoke E2E | Video 5 giây đi qua cả dây chuyền, dùng fake LLM và TTS | Mỗi PR |
| Adapter thật | Gọi thật một câu tới TTS, LLM, API đăng (tốn tiền) | Mỗi đêm hoặc khi sửa adapter |
| LLM eval | Bộ đề trong `evals/` | Khi đổi prompt hoặc model |

Không đặt mục tiêu % coverage. Mục tiêu là: **logic trong `domain/` đều có test, và mỗi lỗi đã sửa đều có một test giữ lại.**

### 6.7 Git, review và version

- **Nhánh ngắn, PR nhỏ** (dưới khoảng 400 dòng), squash merge vào `main`. Commit theo Conventional Commits, ví dụ `feat(audio): add ducking`, `fix(video): caption overflow`.
- **CI phải xanh trước khi merge:** typecheck, Biome, dependency-cruiser, unit, contract, stage, smoke. Golden frame chạy khi PR đụng tới phần dựng hình.
- **Checklist tự review** (1 dev vẫn phải review chính mình, hoặc nhờ Claude review PR):
  1. Có import vượt ranh giới module không?
  2. Dữ liệu từ ngoài vào đã được `parse` bằng zod chưa?
  3. Trong `domain/` có I/O hoặc ngẫu nhiên không?
  4. Code dựng hình có tất định không?
  5. Có test cho logic mới không?
  6. Có lộ secret không?
  7. Có cần tăng version của stage hoặc schema không?
- **Version:**
  - Đổi logic của một stage thì tăng `version` của stage đó, để cache cũ tự hết hiệu lực.
  - Đổi hợp đồng dữ liệu thì tăng `schemaVersion` và viết script chuyển dữ liệu (migration).
  - Đổi prompt thì tăng version của prompt.

### 6.8 Thế nào là "xong" một việc

1. Code chạy, CI xanh.
2. Có test theo mục 6.6.
3. README của module đã cập nhật nếu đổi input/output hoặc cách chạy.
4. Có ADR nếu là quyết định kiến trúc.
5. Không để lại `TODO` mà không có ghi chú `shortcut:`.

---

## 7. Lộ trình chi tiết

Đơn vị là **ngày công** (1 dev). Ước lượng đã tính thời gian debug, chưa tính họp và việc ngoài dự án.

### GĐ 0 — Chốt quyết định và đo thử (tuần 1–2, 17/11–30/11)

| Việc | Ngày | Kết quả |
|---|---|---|
| Chốt bảng giả định (mục 1) và các quyết định (mục 14) với sếp | 1 | Bảng đã duyệt |
| **S1 Render GPU:** thuê một máy GPU trên cloud vài giờ, chạy lại tập 3D của demo bằng `--gl=angle-egl` / `angle` (cần xác nhận cờ nào chạy được), đo số phút mỗi tập | 2 | Quyết định máy render và renderer |
| **S2 TTS:** nghe mù 3–4 nhà cung cấp trên 10 câu lời dẫn kinh dị; tính chi phí mỗi tập; kiểm tra có trả mốc từng từ không | 1,5 | Chọn TTS |
| **S3 LLM:** viết thử `script.json` → `scene.json` bằng Claude API với structured output; đo tỉ lệ hợp lệ và chi phí | 1,5 | Khung prompt + số đo |
| **S4 Vision QA:** lấy khung hình từ 4 video demo, cố ý tạo 10 lỗi, đo Claude bắt được bao nhiêu lỗi | 1 | Biết QA tự động tin được tới đâu |
| **S5 Nền tảng:** tạo Google Cloud project + bật YouTube API; đăng ký app TikTok và **nộp duyệt ngay** (việc duyệt mất nhiều tuần); tạo kênh thử | 0,5 | Hồ sơ đang chờ duyệt |
| **S6 Nhạc và SFX:** chọn nguồn có license; lấy bộ khởi đầu khoảng 30 bài nhạc + 100 SFX, gắn nhãn | 1 | `library/music`, `library/sfx` |
| Viết ADR cho từng quyết định | 0,5 | `docs/adr/*.md` |

**Điểm quyết định:** nếu S1 cho thấy render bằng GPU vẫn trên khoảng 8 phút mỗi tập, hoặc hình không đạt phong cách, thì xem phương án Blender ở mục 8.2 trước khi sang GĐ 1.

### GĐ 1 — Nền móng (tuần 3–4, 1/12–14/12)

| Việc | Ngày |
|---|---|
| Monorepo pnpm, tsconfig strict, Biome, CI, remote git (mục 6.1) | 1 |
| Khung module mẫu (`domain/`, `ports.ts`, `adapters/`, `stages/`, README), `docs/glossary.md`, luật dependency-cruiser (mục 4.8–4.9) | 1 |
| `packages/contracts`: toàn bộ schema ở mục 4.4 + xuất JSON Schema | 2 |
| `packages/core`: LLM client (SDK, structured output, prompt caching, log chi phí), kho artifact (ghi file nguyên tử), config + secret, logger pino, `StageError` | 2 |
| `packages/pipeline`: stage, cache theo hash, trạng thái SQLite, seed, chạy tiếp, lệnh `vf`, `vf runs`, `vf show` | 3 |
| Script chuyển dữ liệu thư viện của demo sang schema mới | 0,5 |
| Khung test: Vitest, `FakeLlm` và `FakeTts`, contract test, golden frame, smoke E2E | 1,5 |

Tổng 11 ngày, tức lấn sang tuần 5 một ngày. Không cắt phần này: mọi giai đoạn sau đều đứng trên nó.

**Xong khi:** một dây chuyền giả (4 bước dùng fake adapter) chạy được, có cache, chạy tiếp được sau khi bị ngắt giữa chừng; CI chặn được một import vượt ranh giới module.

### GĐ 2 — Dựng hình: module B + phần render của D (tuần 5–7, 15/12–4/1, có nghỉ lễ cuối năm)

| Việc | Ngày |
|---|---|
| Style guide | 1 |
| `<Character>`: rig + biểu cảm + viseme + điểm gắn đồ | 3 |
| Action engine: easing, chuyển mượt, chuyển động nền khi đứng yên. Chuyển 23 hành động cũ + thêm ngồi, cầm, đưa | 3 |
| `<SetView>`: đạo cụ, spots, bộ ánh sáng | 3 |
| Góc máy theo spot: toàn cảnh, trung cảnh, cận mặt, qua vai, đẩy chậm, lia, rung | 2 |
| Overlay 2D: HUD, phụ đề theo từ, thẻ luật, CTA | 2 |
| Ảnh xem trước. Có 4 bối cảnh và khoảng 8 nhân vật | 2 |

**Xong khi:** từ một `scene.json` viết tay + audio có sẵn, ra được MP4 đúng phong cách; golden test chạy xanh.

### GĐ 3 — Kịch bản và âm thanh (tuần 8–10, 5/1–25/1)

| Việc | Ngày |
|---|---|
| Định dạng series (`formats/series.json`) + `script.write` + series bible | 3 |
| `script.review`: biên tập tiếng Anh + chặn ký tự ngoài tiếng Anh | 1 |
| `script.direct` + kiểm tra tham chiếu + tự sửa | 2 |
| Bộ đề LLM + chạy đo | 1 |
| Âm thanh: chuẩn hoá chữ, provider TTS, mốc từng từ, cache theo câu | 2 |
| Âm thanh: nhạc, SFX, mix, kiểm tra độ to, kiểm tra đọc thiếu chữ | 2 |
| `video.timeline` nối với audio; `vf make` chạy từ đầu đến cuối | 2 |
| Làm 3 tập đầu tiên, sửa lỗi | 1 |

MVP dùng 2 công thức đã học trong demo (đã chuyển sang schema mới). Việc viết lại `script.ingest` được dời sang GĐ 7, vì chỉ vòng A mới cần học công thức mới thường xuyên.

**Mốc MVP (khoảng 25/1/2027):** `vf make --format series` ra một tập hoàn chỉnh bằng tiếng Anh. Người chỉ sửa `script.json` nếu muốn.

### GĐ 4 — Thử thị trường (tuần 11–14, 26/1–khoảng 28/2, có nghỉ Tết)

- Đăng tay 3–5 tập mỗi tuần lên một kênh YouTube Shorts, thêm TikTok nếu app đã được duyệt.
- Ghi chỉ số của từng tập: view, retention, tỉ lệ xem hết, tỉ lệ người xem từ tập trước sang tập sau, số bình luận 1/2.
- **Trước khi đăng, đặt sẵn ngưỡng đạt**, ví dụ so với video mẫu sếp gửi. Như vậy quyết định đi tiếp hay dừng sẽ dựa trên số liệu, không dựa trên cảm giác.
- **Điểm quyết định sau 4 tuần:**
  - Đạt ngưỡng: sang GĐ 6.
  - Không đạt: sửa định dạng (hook, độ dài, nhịp, giọng, câu chuyện) rồi đăng tiếp. Không đầu tư thêm vào tự động hoá.

### GĐ 5 — QA tự động và biến thể (tuần 12–14, chạy song song với GĐ 4)

| Việc | Ngày |
|---|---|
| Kiểm tra bằng luật: ffmpeg `blackdetect` và `silencedetect`, độ dài, vùng an toàn của phụ đề | 2 |
| Vision QA + kiểm duyệt nội dung (bạo lực, tự hại, người thật) | 3 |
| Vòng tự sửa (`video.fix`) | 2 |
| Lọc trùng: kịch bản (embedding) và hình (pHash) | 2 |
| Biến thể hook và đoạn kết; định dạng skit | 3 |
| Đo QA trên bộ video mẫu có lỗi | 1 |

### GĐ 6 — Đăng tự động và vận hành (tuần 15–17, tháng 3/2027)

| Việc | Ngày |
|---|---|
| Máy render GPU + Docker worker + bảng job | 3 |
| Publisher YouTube; thêm TikTok và Instagram nếu đã được duyệt | 3 |
| Lịch đăng, metadata, nhãn AI, "không dành cho trẻ em" | 2 |
| Công tắc dừng, cảnh báo qua Telegram, giới hạn chi tiêu API | 2 |
| Backup, dọn file cũ, runbook vận hành | 1 |

**Mốc v1:** mỗi ngày tự đăng khoảng 10 video, không cần người chạm vào.

### GĐ 7 — Vòng học và thư viện tự sinh (tuần 18–21, tháng 4/2027)

| Việc | Ngày |
|---|---|
| Kéo số liệu, đếm bình chọn 1/2 | 3 |
| Chấm điểm công thức, chọn theo tỉ lệ 80/20, file bài học `lessons.md` hằng tuần | 3 |
| Viết lại `script.ingest` (whisperX, PySceneDetect) + ingest định kỳ + phát hiện linh kiện còn thiếu | 4 |
| `assets.generate`: AI tạo nhân vật, bối cảnh, hành động + ảnh xem trước + QA | 5 |

### Dự phòng

Cộng thêm khoảng 20% (khoảng 4 tuần) cho lỗi không lường trước và thời gian chờ duyệt API. **Hoàn thành v2: khoảng giữa đến cuối tháng 5/2027.**

```
          T11       T12       T1        T2        T3        T4        T5
GĐ0       ██
GĐ1         ██
GĐ2           ███
GĐ3                ███
                     ▲ MVP
GĐ4                     ████ (Tết)
GĐ5                      ███
GĐ6                           ███
                                ▲ v1
GĐ7                                    ████
Dự phòng                                    ████
                                               ▲ v2
```

---

## 8. Công nghệ

### 8.1 Chọn dùng

| Hạng mục | Chọn | Vì sao | Dự phòng hoặc khi nào đổi |
|---|---|---|---|
| Ngôn ngữ, runtime | TypeScript, Node 24 | Cùng ngôn ngữ với Remotion và React, demo đã chạy tốt | — |
| Công cụ ML | Python qua `uv` | whisperX và PySceneDetect chỉ có bản Python | — |
| Monorepo | pnpm workspaces | Đơn giản, đủ dùng | Turborepo khi build chậm |
| Hợp đồng dữ liệu | zod 4 + xuất JSON Schema | Một nguồn duy nhất cho validate và cho prompt | — |
| LLM | Claude API (`@anthropic-ai/sdk`): **Opus 5.5** cho ingest, viết series và dàn dựng; **Sonnet 5.5** cho skit, biến thể và QA; **Haiku 4.5** cho việc vặt (chuẩn hoá, gắn nhãn) | Demo đã chứng minh được chất lượng | Structured output; prompt caching cho thư viện và định dạng; Batch API cho biến thể |
| Tải video | yt-dlp | Hỗ trợ nhiều nền tảng nhất | gallery-dl |
| Tách lời | whisperX | Mốc từng từ chính xác, có tách người nói | faster-whisper (demo đang dùng) |
| Tách cảnh | PySceneDetect | Lấy khung hình đúng điểm cắt cảnh | Chia đều (như demo) |
| Dựng 3D | Three.js + React Three Fiber (+ drei cho viền và bóng) | Demo chạy được; nhân vật dựng bằng code | Blender (mục 8.2) |
| Ghép và render | Remotion 4 + `@remotion/three` | Dòng thời gian, phụ đề và overlay làm bằng React, render ra MP4 | Tự render từng khung hình rồi ghép bằng ffmpeg nếu vướng license |
| TTS (chỉ giọng en-US) | Chọn sau spike S2. Ứng viên: ElevenLabs (giọng Anh giàu cảm xúc, hợp lời dẫn kinh dị), Azure Speech (bản chính thức của các giọng edge-tts trong demo), Google Cloud TTS, OpenAI TTS | Chỉ cần tiếng Anh nên có nhiều lựa chọn tốt; tiêu chí chính là cảm xúc, khoảng ngừng và mốc từng từ | TTS chạy trên máy (Kokoro, Piper) làm dự phòng khi API lỗi |
| Nhạc | Thư viện có license (Epidemic Sound, Artlist hoặc tương đương) | Tránh bị gậy bản quyền | YouTube Audio Library; nhạc AI phải đọc kỹ điều khoản thương mại |
| SFX | Thư viện SFX có license | — | Freesound (kiểm tra license từng file) |
| Mix âm thanh | ffmpeg (`loudnorm`, `sidechaincompress`, `ebur128`) | Có sẵn, chạy trong script được | — |
| Nhép miệng | Viseme từ mốc từng từ | Tốt hơn cách dùng độ to âm thanh trong demo | Rhubarb Lip Sync |
| QA | ffmpeg (`blackdetect`, `silencedetect`) + Claude vision | Luật bắt lỗi chắc chắn; vision bắt lỗi khó | — |
| Lọc trùng | Embedding văn bản (kịch bản) + pHash (hình) | Rẻ, nhanh | SSIM |
| Trạng thái, hàng đợi | SQLite (`node:sqlite` hoặc better-sqlite3) | Không cần server | Postgres + pg-boss khi có nhiều máy |
| Lưu file | Ổ cục bộ | Đơn giản | S3, Cloudflare R2 hoặc MinIO khi có máy render riêng |
| Triển khai | Docker image cho worker render (khoá phiên bản Chrome, ffmpeg, font) | Render giống nhau trên mọi máy | — |
| CI | GitHub Actions (hoặc Gitea Actions) | Typecheck, lint, luật kiến trúc, test, golden frame | — |
| Lint + format | Biome | Một công cụ làm cả hai việc, nhanh, ít config | ESLint + Prettier nếu cần rule Biome chưa có |
| Luật kiến trúc | dependency-cruiser + trường `exports` trong `package.json` | Ép ranh giới module trong CI | — |
| Test | Vitest + pixelmatch (golden frame) | Chạy TS/ESM trực tiếp, có chế độ watch | `node:test` |
| Logger | pino (log JSON có cấu trúc) | Nhanh, chuẩn, dễ lọc theo `runId` | — |
| Giám sát | Log JSON + bot Telegram báo lỗi và chi phí | Đủ cho 1 người vận hành | Grafana khi có nhiều máy |
| Secret | File `.env` không commit, có `.env.example` | — | Trình quản lý secret khi có nhiều người |
| Đăng bài | YouTube Data API v3, TikTok Content Posting API, Instagram Graph API | API chính thức | — |
| Số liệu | YouTube Analytics API, TikTok API, Instagram Insights | — | — |

### 8.2 Phương án renderer dự phòng: Blender chạy không giao diện

Chỉ dùng khi spike S1 thất bại, hoặc khi hình của Three.js không đạt phong cách.

- **Ưu điểm:**
  - Hình đẹp hơn: shader toon, bóng, viền đều tốt hơn.
  - Render bằng GPU với Eevee.
  - Nhập model `.glb` dễ.
- **Nhược điểm:**
  - Thêm một hệ Python riêng (`bpy`).
  - HUD và phụ đề phải ghép sau bằng Remotion hoặc ffmpeg.
  - Mỗi lần chỉnh phải chờ render, chậm hơn xem trực tiếp trên trình duyệt.
  - Ước tính GĐ 2 kéo dài thêm khoảng 1–2 tuần.
- **Không chọn:** Unity, Unreal, Godot. Chúng nặng, khó render tự động trên server, và không hợp với cách dựng nhân vật bằng code.

---

## 9. Phần cứng

| Giai đoạn | Máy | Cấu hình |
|---|---|---|
| GĐ 0–5 | Máy dev hiện tại | 12 nhân CPU, 14 GB RAM, không có GPU. **Nên nâng lên 32 GB RAM**, vì 14 GB đã làm Chrome crash khi render 4 luồng song song |
| GĐ 0 (spike) | Máy GPU thuê trên cloud | Thuê theo giờ, chỉ để đo |
| GĐ 6+ | Máy render (worker) | GPU NVIDIA tầm trung (8–12 GB VRAM), CPU 8–16 nhân, RAM 32–64 GB, SSD NVMe 1–2 TB, Ubuntu. Chỉ mua sau khi S1 cho ra số đo |
| GĐ 6+ | Lưu trữ lâu dài | NAS hoặc object storage (R2, S3) cho video đã đăng |
| Mọi giai đoạn | Điện và mạng | UPS cho máy render; mạng ổn định. Upload nhẹ: 50 video mỗi ngày chỉ khoảng 1,5 GB |

**Cách tính số máy render:** số giờ render mỗi ngày = số video × phút render mỗi video ÷ 60.

Ví dụ, nếu render trên CPU mất 11 phút mỗi tập:
- 10 tập mỗi ngày cần khoảng 2 giờ. Máy hiện tại đủ.
- 50 tập mỗi ngày cần khoảng 9 giờ. Phải có GPU hoặc thêm máy.

**Dung lượng:** mỗi tập 2 phút khoảng 25–32 MB. Với 50 tập mỗi ngày, mỗi tháng thêm khoảng 45 GB, chưa tính file trung gian. Nên xoá file trung gian sau 7 ngày.

---

## 10. Chi phí

Phần này cần điền lại sau spike S2 và S3. Giá dịch vụ phải tra theo bảng giá hiện hành.

**Theo từng video:**

| Khoản | Cách tính | Mốc từ demo |
|---|---|---|
| Claude: viết truyện + dàn dựng | Số token × giá model | $0,25–0,50 mỗi tập series (1 bước). Bản mới có 2 bước nên dự kiến $0,40–0,80 |
| Claude: vision QA | Số khung hình × token ảnh | Đo ở S4 |
| TTS | Số ký tự × giá | Một tập 2 phút khoảng 1.300–1.800 ký tự |
| Render | Giờ máy × giá điện, hoặc giá thuê cloud | — |

**Cố định hằng tháng:** license nhạc và SFX, gói TTS, hạn mức Claude API, lưu trữ, tên miền (nếu có).

**Một lần:** máy render GPU, nâng RAM máy dev.

**Bắt buộc:** đặt giới hạn chi tiêu trên Claude API và trên TTS, và có cảnh báo khi chi phí trong ngày vượt ngưỡng.

---

## 11. Yêu cầu

### 11.1 Yêu cầu chức năng
- Một lệnh ra một video. Không có ý tưởng thì hệ thống vẫn tự chạy bằng công thức trong thư viện.
- Người sửa `script.json` (truyện và lời thoại) rồi chạy tiếp, không phải sửa JSON dàn dựng.
- Mỗi bước chạy riêng được và chạy lại được. Sửa một câu thoại thì không gọi lại Claude cho cả tập.
- Series tự nối mạch theo series bible và theo lựa chọn của khán giả.
- Video ra 1080×1920, 30 fps, có phụ đề, có nhạc, âm lượng chuẩn.
- **Toàn bộ nội dung bằng tiếng Anh (US English):** lời dẫn, lời thoại, chữ trên màn hình, phụ đề, tiêu đề, mô tả, hashtag. Không có chữ nào bằng ngôn ngữ khác lọt vào video.

### 11.2 Chỉ tiêu cần đạt

| Chỉ tiêu | MVP | v1 |
|---|---|---|
| Kịch bản hợp lệ ngay lần đầu | ≥ 80% | ≥ 90% |
| Chi phí Claude mỗi tập series | ≤ $1 | ≤ $0,80 |
| Thời gian render mỗi tập | ≤ 15 phút | ≤ 5 phút |
| Video qua QA mà không phải sửa | — | ≥ 80% |
| Video hỏng lọt qua QA | — | ≤ 2% |
| Lỗi giữa chừng | Chạy tiếp được, không mất bước đã trả tiền | Tự thử lại |
| Lỗi tiếng Anh (ngữ pháp, câu không tự nhiên) do người bản xứ chấm trên mẫu | ≤ 1 lỗi mỗi tập | ≤ 1 lỗi mỗi 3 tập |
| CI (lint, luật kiến trúc, test) | Luôn xanh trên `main` | Luôn xanh trên `main` |

### 11.3 Tài khoản, khoá và license
- Claude API key riêng, có giới hạn chi tiêu.
- Tài khoản TTS trả phí.
- License nhạc và SFX, lưu lại bằng chứng.
- Google Cloud project cho YouTube API. Hạn mức (quota) upload mặc định có giới hạn; muốn tăng phải xin.
- App TikTok Developer, **nộp duyệt sớm**. App chưa qua duyệt chỉ đăng được ở chế độ riêng tư.
- Instagram Business + Meta app (nếu đăng Reels).
- Remotion: miễn phí cho cá nhân hoặc công ty ≤ 3 người. Đông hơn phải mua company license.

### 11.4 Kỹ năng dev cần có
- TypeScript, React, Three.js / React Three Fiber.
- ffmpeg và xử lý âm thanh cơ bản.
- Viết prompt và đo LLM bằng bộ đề.
- Đọc hiểu tiếng Anh tốt để duyệt kịch bản. Giọng văn tự nhiên thì để Claude và người bản xứ lo (mục 12, rủi ro 13).
- Docker, Linux, cron.
- Phần khó nhất là rig nhân vật và action engine (GĐ 2). Nếu chưa quen Three.js, nên cộng thêm 1 tuần vào GĐ 2.

---

## 12. Rủi ro và thách thức

| # | Rủi ro | Khả năng | Ảnh hưởng | Cách giảm | Xử lý ở |
|---|---|---|---|---|---|
| 1 | Khán giả không xem, retention thấp | Trung bình | Rất cao | Đăng thật sớm (GĐ 4); có điểm quyết định; sửa định dạng trước khi tự động hoá | GĐ 4 |
| 2 | Nền tảng giảm reach hoặc tắt kiếm tiền vì nội dung hàng loạt | Trung bình | Cao | Biến thể khác nhau thật, lọc trùng, không đăng dồn, có công tắc dừng | GĐ 5–6 |
| 3 | Render 3D quá chậm | Cao | Cao | Spike S1, GPU, render song song, phương án Blender | GĐ 0, 6 |
| 4 | Hình 3D khối trông rẻ tiền | Trung bình | Cao | Style guide, ánh sáng, viền, đạo cụ `.glb`; sếp duyệt phong cách sớm | GĐ 2 |
| 5 | API TikTok, Instagram duyệt lâu hoặc bị từ chối | Cao | Trung bình | Nộp duyệt ở tuần 1; bắt đầu với YouTube | GĐ 0 |
| 6 | Vision QA chấm sai | Trung bình | Trung bình | Bộ video mẫu có lỗi biết trước; ưu tiên kiểm tra bằng luật; thỉnh thoảng cho người kiểm tra ngẫu nhiên | GĐ 5 |
| 7 | Claude viết lặp lại, nhạt | Cao | Trung bình | Lịch sử hook đã dùng, lọc trùng, bài học, bộ đề | GĐ 3, 5 |
| 8 | Chi phí API tăng vọt (lỗi vòng lặp, thử lại vô hạn) | Thấp | Cao | Giới hạn chi tiêu, giới hạn số lần thử, cảnh báo | GĐ 1, 6 |
| 9 | Dev một mình bị trễ, quá tải hoặc nghỉ | Cao | Cao | Phạm vi MVP chặt; 20% dự phòng; ADR và runbook để người khác tiếp quản được | Mọi GĐ |
| 10 | Phạm vi phình ra ("thêm tính năng này nữa") | Cao | Cao | Bảng phạm vi ở mục 3; việc mới đưa vào mốc sau, không chen vào mốc hiện tại | Mọi GĐ |
| 11 | Phiên bản Chrome, Remotion hoặc thư viện đổi làm hỏng render | Trung bình | Trung bình | Khoá phiên bản, Docker, golden test | GĐ 1, 6 |
| 12 | Dữ liệu hiệu suất còn ít khiến vòng học học sai | Cao | Trung bình | Chỉ tin điểm khi mỗi công thức có ≥ 5–10 video | GĐ 7 |
| 13 | Tiếng Anh nghe "không bản xứ": đội không phải người bản xứ nên khó tự nhận ra câu gượng | Trung bình | Cao | Bước `script.review`; thuê một người bản xứ (freelance) duyệt 10 tập đầu và chấm lỗi; dùng nhận xét của họ làm bộ đề và bài học | GĐ 3–4 |
| 14 | Codebase xuống cấp vì làm vội: module dính nhau, thiếu test | Cao | Cao | Luật kiến trúc trong CI, checklist review, định nghĩa "xong" (mục 6); không bỏ GĐ 1 | Mọi GĐ |

---

## 13. Vấn đề ngoài lề

### 13.1 Pháp lý và bản quyền
- **Chỉ học cơ chế, không chép nội dung.** Không làm lại câu chuyện, nhân vật, bối cảnh hay tên series của người khác, kể cả series sếp gửi làm mẫu.
- **Tải video từ TikTok, YouTube, X có thể vi phạm điều khoản sử dụng.** Chỉ dùng để phân tích nội bộ, không lưu lâu, không đăng lại.
- **Nhạc và SFX:** chỉ dùng nguồn có license, lưu bằng chứng license cho từng file.
- **Quyền tác giả với nội dung do AI tạo** chưa rõ ràng ở nhiều nước, nên khó bảo vệ khi bị người khác sao chép. Tài sản cần giữ là thương hiệu, tên kênh và nhân vật.
- **Thuế và thu nhập** từ kiếm tiền trên nền tảng: hỏi kế toán khi bắt đầu có doanh thu. Kênh có người xem ở Mỹ thì phải khai thông tin thuế với Google AdSense (người ngoài Mỹ có thể bị khấu trừ thuế trên doanh thu từ người xem Mỹ). Kiểm tra quy định hiện hành.

### 13.2 Chính sách nền tảng
- **Nội dung lặp lại, sản xuất hàng loạt:** YouTube có chính sách về nội dung "inauthentic" và lặp lại; TikTok cũng hạn chế nội dung kém nguyên bản.
- **Nhãn nội dung AI:** kiểm tra quy định hiện hành của từng nền tảng và gắn nhãn khi cần.
- **Hoạt hình kết hợp kinh dị:** video dễ bị coi là nội dung cho trẻ em (quy định COPPA của YouTube). Luôn đánh dấu "không dành cho trẻ em", và giữ mức hù doạ trong giới hạn của nền tảng.
- **Nhiều kênh cùng một chủ:** nền tảng có thể phát hiện các kênh liên quan nhau và phạt cả cụm. Không dùng thủ thuật lách luật.
- **Độ dài video:** tập khoảng 2 phút phải nằm trong giới hạn độ dài của từng nền tảng (kiểm tra lại trước khi chốt định dạng).
- **Đếm bình chọn:** API đọc bình luận có hạn mức. Kết quả có thể bị bot làm sai lệch.

### 13.3 Vận hành và kinh doanh
- Cần một người nhận cảnh báo khi kênh bị cảnh cáo, API lỗi hoặc chi phí tăng bất thường. Tự động không có nghĩa là không có người trực.
- Xây thương hiệu và "vũ trụ" nhân vật riêng. Về lâu dài, thứ này có giá trị hơn từng video viral lẻ.
- Đo đúng thứ cần đo: view rất rẻ. Retention và tỉ lệ người xem từ tập trước sang tập sau mới cho thấy series có sống được hay không.
- **Khán giả nói tiếng Anh:**
  - Giờ đăng, giờ đọc bình luận và giờ trả lời bình luận đều rơi vào ban đêm ở Việt Nam, nên lịch đăng và cảnh báo phải tự động.
  - Phải hiểu văn hoá và cách nói của người Mỹ: tiếng lóng, meme, những chủ đề nhạy cảm cần tránh.
  - Thị trường tiếng Anh cạnh tranh hơn, nhưng RPM (doanh thu trên 1.000 view) thường cao hơn.

### 13.4 An toàn nội dung
- Không làm nội dung về người thật, thương hiệu thật hoặc bi kịch có thật.
- Không có bạo lực đẫm máu, không có tự hại.
- Bước QA phải kiểm duyệt cả nội dung, không chỉ kiểm tra hình.

---

## 14. Cần chốt trước khi bắt đầu GĐ 1

| Câu hỏi | Ảnh hưởng tới | Đề xuất |
|---|---|---|
| Nền tảng chính? | Độ dài, nhịp, API làm trước | YouTube Shorts trước; nộp duyệt TikTok song song |
| Series hay skit trước? | Thư viện cần có ở MVP | Series |
| Ngưỡng "đạt" của GĐ 4 là bao nhiêu? | Quyết định đi tiếp | Sếp đặt, so với video mẫu |
| Ngân sách tháng (API, TTS, nhạc) và ngân sách một lần (máy GPU, RAM) | GĐ 0, 2, 6 | Chốt trong tuần 1 |
| Bao nhiêu kênh, mỗi kênh bao nhiêu video mỗi ngày (ở v1)? | Phần cứng | 1–2 kênh × 3–5 video mỗi ngày, đo rồi mới tăng |
| Giọng và thị trường: US English hay cả UK/AU? Một giọng dẫn cố định cho mọi series hay mỗi series một giọng? | TTS, style guide của lời | US English; mỗi series một giọng dẫn cố định để thành "thương hiệu" |
| Có thuê người bản xứ duyệt 10 tập đầu không? | Chất lượng tiếng Anh | Có, ngân sách nhỏ, việc làm một lần |
| Repo đặt ở đâu (GitHub riêng tư, Gitea tự host)? | Backup, CI | Chốt ngày đầu |

---

## 15. Chỉ số theo dõi

- **Sản xuất:** số video mỗi ngày, phút render mỗi video, chi phí mỗi video (theo từng bước), tỉ lệ qua QA, tỉ lệ lỗi theo từng module.
- **Chất lượng LLM:** điểm trên bộ đề, tỉ lệ hợp lệ ngay lần đầu, độ giống giữa các kịch bản.
- **Khán giả:** view, retention theo từng công thức, tỉ lệ xem hết, tỉ lệ người xem từ tập trước sang tập sau, số bình luận 1/2.
- **Sức khoẻ kênh:** số lần bị cảnh báo, reach theo tuần, số video bị giới hạn hiển thị.
