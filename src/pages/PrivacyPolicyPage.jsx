export default function PrivacyPolicyPage() {
  return (
    <section className="mx-auto max-w-4xl space-y-4 rounded-3xl border border-white/10 bg-emerald-900/60 p-5 sm:p-6">
      <h1 className="font-heading text-3xl font-bold text-white">Privacy Policy</h1>
      <p className="text-sm leading-6 text-emerald-100">
        Zetoon menghormati privasi pengguna. Website ini tidak mewajibkan akun dan tidak menggunakan sistem login.
      </p>
      <p className="text-sm leading-6 text-emerald-100">
        Data riwayat baca, readlist, dan preferensi pencarian disimpan lokal di browser melalui localStorage.
      </p>
      <p className="text-sm leading-6 text-emerald-100">
        Dengan menggunakan situs ini, kamu menyetujui kebijakan privasi ini. Kebijakan dapat diperbarui sewaktu-waktu.
      </p>
    </section>
  );
}
