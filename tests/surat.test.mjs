import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { inflateSync } from "node:zlib";
import { createTsLoader } from "./helpers/load-ts.mjs";

const load = createTsLoader();
const { generateLetterPdf, wrapLetterText } = load("src/features/surat/pdf");
const { extractLetterToken, letterVerificationUrl } = load("src/features/surat/qr");
const { verificationState } = load("src/features/surat/verification");
const token = "abcdef12-3456-4789-8abc-123456789abc";
const origin = "https://sipensi.example";
const verifyUrl = `${origin}/verify/${token}`;

export const letterFixture = {
  letterNumber: "SIP/2026/CONTOH-001", studentName: "Nadia Putri (Siswa Contoh)",
  className: "XI RPL 1", nis: "CONTOH-12345", izinType: "dispensasi",
  reason: "Mengikuti seleksi lomba kompetensi siswa sebagai perwakilan sekolah.",
  requestedAt: "2026-11-03T02:00:00.000Z", requestedUntil:"2026-11-03T04:00:00.000Z", issuedAt: "2026-11-03T01:45:00.000Z",
  decidedAt: "2026-11-03T01:45:00.000Z", approverName: "Budi Santoso, S.Kom. (Guru Contoh)", approverRole: "guru_mapel", lessonPeriodStart:3, lessonPeriodEnd:5,
};

const verificationFixture = {
  letterNumber: letterFixture.letterNumber, studentName: letterFixture.studentName,
  className: letterFixture.className, izinType: letterFixture.izinType,
  status: "approved", requestedAt: letterFixture.requestedAt, issuedAt: letterFixture.issuedAt,
  decidedAt: letterFixture.decidedAt, requestedUntil:letterFixture.requestedUntil,
  lessonPeriodStart:3, lessonPeriodEnd:5,
};

test("PDF berisi halaman A4, gambar logo/QR, dan aliran isi", async () => {
  const bytes = await generateLetterPdf(letterFixture, verifyUrl);
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
  assert.ok(bytes.byteLength > 5000);
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.match(pdf.getTitle(), /SIP\/2026\/CONTOH-001/);
  const page = pdf.getPage(0);
  assert.ok(Math.abs(page.getWidth() - 595.28) < 0.1);
  assert.ok(page.node.Contents());
  assert.ok(page.node.Resources().toString().includes("/XObject"));
});

test("alasan panjang, kata tanpa spasi, dan tanda baca tidak membuat PDF kosong", async () => {
  const normal = await PDFDocument.load(await generateLetterPdf({ ...letterFixture, reason: "Mengikuti kegiatan resmi sekolah dan persiapan lomba. ".repeat(22).slice(0, 1000) }, verifyUrl));
  assert.equal(normal.getPageCount(), 1);
  const pdf = await PDFDocument.load(await generateLetterPdf({ ...letterFixture, reason: `Kegiatan “resmi” — ${"W".repeat(1000)}\nBagian terakhir alasan.` }, verifyUrl));
  assert.ok(pdf.getPageCount() >= 1);
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const lines = wrapLetterText("W".repeat(1000), font, 11, 300);
  assert.equal(lines.join(""), "W".repeat(1000));
  for (const line of lines) assert.ok(font.widthOfTextAtSize(line, 11) <= 300);
});

test("QR yang dihasilkan dapat dibaca dan menunjuk token verifikasi yang sama", () => {
  const code = QRCode.create(verifyUrl, { errorCorrectionLevel: "M" });
  const scale = 8;
  const side = (code.modules.size + 8) * scale;
  const pixels = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let y = 0; y < code.modules.size; y++) for (let x = 0; x < code.modules.size; x++) {
    if (!code.modules.get(y, x)) continue;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const index = (((y + 4) * scale + dy) * side + (x + 4) * scale + dx) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = 0;
    }
  }
  assert.equal(jsQR(pixels, side, side)?.data, verifyUrl);
});

test("tautan QR memakai origin yang benar dan menolak URL asing", () => {
  assert.equal(letterVerificationUrl(token, `${origin}/surat/${token}`, `${origin}/`), verifyUrl);
  assert.equal(letterVerificationUrl(token, "http://localhost:3000/surat/a"), `http://localhost:3000/verify/${token}`);
  assert.throws(() => letterVerificationUrl(token, `${origin}/surat/a`, "http://localhost:3000"));
  assert.throws(() => letterVerificationUrl(token, `${origin}/surat/a`, "javascript:alert(1)"));
  assert.equal(extractLetterToken(verifyUrl, origin), token);
  assert.equal(extractLetterToken(token, origin), token);
  for (const input of [`https://asing.example/verify/${token}`, `javascript:alert(1)`, `${origin}/verify/palsu`, `${verifyUrl}?redirect=evil`, `${origin}/surat/${token}`, "bukan QR"]) {
    assert.equal(extractLetterToken(input, origin), null, input);
  }
});

test("verifikasi mengikuti persetujuan dan rentang jam, tanpa status pemantauan", () => {
  const now = Date.parse("2026-11-03T03:30:00Z");
  assert.equal(verificationState(verificationFixture, now).title,"Izin disetujui");
  assert.match(verificationState(verificationFixture, Date.parse("2026-11-03T01:00:00Z")).title, /belum dimulai/);
  assert.match(verificationState(verificationFixture, Date.parse("2026-11-03T04:01:00Z")).title, /telah berakhir/);
  assert.match(verificationState({...verificationFixture,requestedUntil:null},Date.parse("2026-11-04T03:00:00Z")).title,/sudah lewat/);
  for (const status of ["pending", "rejected", "cancelled", "expired"]) assert.equal(verificationState({ ...verificationFixture, status }, now).tone, "danger");
});

function fakeAdmin(status = "approved", uploadFails = false) {
  const calls = { downloads: 0, uploads: [], updates: [] };
  const admin = {
    from(table) {
      let id;
      let updating;
      const query = {
        select() { return query; }, update(value) { updating = value; return query; },
        eq(column, value) {
          id = value;
          if (updating) { calls.updates.push(updating); return Promise.resolve({ error: null }); }
          return query;
        },
        async maybeSingle() {
          if (table === "digital_letters") return { data: { id: "letter", request_id: "request", letter_number: letterFixture.letterNumber, issued_at: letterFixture.issuedAt, pdf_url: "ancien/fichier-vide.pdf" }, error: null };
          if (table === "permission_requests") return { data: { student_id: "student", class_id: "class", izin_type: "dispensasi", reason: letterFixture.reason, requested_at: letterFixture.requestedAt, requested_until:letterFixture.requestedUntil,lesson_period_start:3,lesson_period_end:5,status,decided_by:"teacher",decided_at:letterFixture.decidedAt }, error: null };
          if (table === "profiles") return { data: id === "student" ? { full_name: letterFixture.studentName, nis: letterFixture.nis } : { full_name: letterFixture.approverName, role: "guru_mapel" }, error: null };
          return { data: { name: letterFixture.className }, error: null };
        },
      };
      return query;
    },
    storage: { from() { return {
      async download() { calls.downloads++; return { data: new Blob([]) }; },
      async upload(storagePath, bytes) { calls.uploads.push({ storagePath, bytes }); if (uploadFails === "throw") throw new Error("offline"); return { error: uploadFails ? { message: "offline" } : null }; },
    }; } },
  };
  return { admin, calls };
}

test("file kosong lama tidak digunakan dan unduhan tetap berhasil ketika Storage gagal", async () => {
  for (const uploadFails of [false, true, "throw"]) {
    const { admin, calls } = fakeAdmin("approved", uploadFails);
    const loader = createTsLoader({ "@/lib/supabase/admin": { createAdminClient: () => admin } });
    const { ensureLetterPdf } = loader("src/features/surat/letter");
    const result = await ensureLetterPdf(token, verifyUrl);
    assert.ok(result.bytes.byteLength > 5000);
    assert.equal(calls.downloads, 0);
    assert.equal(calls.uploads.length, 1);
    assert.equal((await PDFDocument.load(result.bytes)).getPageCount(), 1);
  }
});

test("pengajuan belum disetujui tidak dapat menghasilkan surat", async () => {
  for (const status of ["pending", "rejected", "cancelled"]) {
    const { admin, calls } = fakeAdmin(status);
    const loader = createTsLoader({ "@/lib/supabase/admin": { createAdminClient: () => admin } });
    assert.equal(await loader("src/features/surat/letter").ensureLetterPdf(token, verifyUrl), null);
    assert.equal(calls.uploads.length, 0);
  }
});

test("verifikasi publik tidak mengembalikan alasan, NIS atau bukti", async () => {
  const { admin } = fakeAdmin();
  const loader = createTsLoader({ "@/lib/supabase/admin": { createAdminClient: () => admin } });
  const info = await loader("src/features/surat/verification-data").readLetterVerification(token);
  assert.equal(info.studentName, letterFixture.studentName);
  for (const key of ["reason", "nis", "evidence_url", "student_id", "durationMinutes", "returnedAt"]) assert.equal(Object.hasOwn(info, key), false);
});

function pdfText(pdf) {
  const chunks=[];
  for(const page of pdf.getPages()){
    const streams=page.node.Contents();
    for(let i=0;i<streams.size();i++){
      const stream=pdf.context.lookup(streams.get(i));
      const raw=/FlateDecode/.test(stream.dict.toString())?inflateSync(stream.getContents()):stream.getContents();
      chunks.push(...Array.from(Buffer.from(raw).toString().matchAll(/<([0-9a-f]+)>\s*Tj/gi),match=>Buffer.from(match[1],"hex").toString("latin1")));
    }
  }
  return chunks.join(" ");
}

test("isi surat ringkas memuat rentang dan persetujuan, tanpa petunjuk timer",async()=>{
  const text=pdfText(await PDFDocument.load(await generateLetterPdf(letterFixture,verifyUrl)));
  assert.match(text,/SURAT IZIN SISWA/);
  assert.match(text,/Jam ke-3 s.d. ke-5/);
  assert.match(text,/09.00-11.00 WIB/);
  assert.match(text,/Nadia Putri/);assert.match(text,/Budi Santoso/);
  assert.doesNotMatch(text,/Mulai Dispen|Kembali ke Sekolah|Hitung mundur|tanpa tanda tangan|DISETUJUI SECARA DIGITAL/);
  const legacy=pdfText(await PDFDocument.load(await generateLetterPdf({...letterFixture,lessonPeriodStart:null,lessonPeriodEnd:null,requestedUntil:null},verifyUrl)));
  assert.match(legacy,/Waktu izin/);
  assert.doesNotMatch(legacy,/Jam ke-/);
});

test("route unduhan menjaga akses dan mengirim byte PDF sebagai lampiran", async () => {
  const bytes = await generateLetterPdf(letterFixture, verifyUrl);
  let allowed = true;
  let loggedIn = true;
  const loader = createTsLoader({
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: loggedIn ? { id: "student" } : null } }) },
      from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: allowed ? { id: "letter" } : null }) }),
    }) },
    "@/features/surat/letter": { ensureLetterPdf: async () => ({ bytes, filename: "Surat-Izin-Contoh.pdf" }) },
  });
  const { GET } = loader("src/app/surat/[token]/route");
  const request = new Request(`${origin}/surat/${token}`);
  const context = { params: Promise.resolve({ token }) };
  const response = await GET(request, context);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "application/pdf");
  assert.match(response.headers.get("Content-Disposition"), /^attachment;/);
  assert.equal(response.headers.get("Content-Length"), String(bytes.byteLength));
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  allowed = false;
  assert.equal((await GET(request, context)).status, 403);
  loggedIn = false;
  assert.match((await GET(request, context)).headers.get("Location"), /\/login$/);
});

test("aksi pemindai menerima guru/admin dan menolak siswa sebelum membaca data", async () => {
  for (const role of ["siswa", "guru_mapel", "wali_kelas", "guru_bk", "admin"]) {
    const { admin } = fakeAdmin();
    let adminReads = 0;
    const loader = createTsLoader({
      "next/navigation": { redirect: (url) => { throw new Error(`REDIRECT ${url}`); } },
      "@/lib/supabase/server": { createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: "viewer" } } }) },
        from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { id: "viewer", role } }) }),
      }) },
      "@/lib/supabase/admin": { createAdminClient: () => { adminReads++; return admin; } },
    });
    const { verifyScannedLetter } = loader("src/app/(app)/scan/actions");
    if (role === "siswa") {
      await assert.rejects(() => verifyScannedLetter(token), /REDIRECT \/dashboard/);
      assert.equal(adminReads, 0);
    } else {
      assert.equal((await verifyScannedLetter(token)).info.studentName, letterFixture.studentName);
      assert.ok((await verifyScannedLetter("invalid")).error);
    }
  }
});
