export default function ContactPage() {
  return (
    <section className="mx-auto max-w-4xl space-y-4 rounded-3xl border border-white/10 bg-emerald-900/60 p-5 sm:p-6">
      <h1 className="font-heading text-3xl font-bold text-white">Contact</h1>
      <p className="text-sm leading-6 text-emerald-100">
        Untuk pertanyaan bisnis, laporan konten, atau kerja sama, hubungi kami melalui email berikut:
      </p>
      <a href="mailto:akuryzel@gmail.com" className="inline-flex rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white">
        akuryzel@gmail.com
      </a>
      <p className="text-xs text-emerald-200">Silakan ganti email ini dengan email resmi domain kamu sebelum publish.</p>
    </section>
  );
}
