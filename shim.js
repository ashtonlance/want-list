/* Supabase-backed stand-in for the Claude page runtime (db, user, assets). */
(() => {
  const cfg = window.WL_CONFIG || {};
  const ready = !!(cfg.url && cfg.anonKey && window.supabase);
  const sb = ready ? window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, detectSessionInUrl: true } }) : null;
  window.WL = { sb, ready };
  const fail = (e, code) => Object.assign(new Error((e && e.message) || code || "error"), { code: code || "invalid_argument" });
  function collection(table) {
    return {
      onSnapshot(cb, onErr) {
        let alive = true;
        const load = async () => {
          const all = []; let from = 0;
          for (;;) {
            const { data, error } = await sb.from(table).select("id,data").range(from, from + 999);
            if (error) { onErr && onErr(error); return; }
            all.push(...data); if (data.length < 1000) break; from += 1000;
          }
          if (alive) cb({ docs: all.map(r => ({ id: r.id, data: () => r.data })) });
        };
        load();
        let t; const ch = sb.channel("rt-" + table).on("postgres_changes", { event: "*", schema: "public", table }, () => { clearTimeout(t); t = setTimeout(load, 150); }).subscribe();
        document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
        return () => { alive = false; sb.removeChannel(ch); };
      },
      doc(id) {
        return {
          async set(data) { const { error } = await sb.from(table).upsert({ id, data, updated_at: new Date().toISOString() }); if (error) throw fail(error); },
          async update(patch) {
            const { data: row, error: e1 } = await sb.from(table).select("data").eq("id", id).maybeSingle(); if (e1) throw fail(e1);
            const { error } = await sb.from(table).upsert({ id, data: { ...(row ? row.data : {}), ...patch }, updated_at: new Date().toISOString() }); if (error) throw fail(error);
          },
          async delete() { const { error, count } = await sb.from(table).delete({ count: "exact" }).eq("id", id); if (error || count === 0) throw fail(error, "invalid_argument"); },
        };
      },
    };
  }
  let editor = null;
  async function isEditor() {
    if (editor !== null) return editor;
    const { data: s } = await sb.auth.getSession(); const email = s.session && s.session.user.email;
    if (!email) return (editor = false);
    const { data } = await sb.from("editors").select("email").eq("email", email.toLowerCase()).maybeSingle();
    return (editor = !!data);
  }
  const api = {
    db: { collection },
    user: { can: async n => n === "data.write" ? isEditor() : false },
    assets: { upload: async file => {
      if (!(await isEditor())) throw fail(null, "not_granted");
      if (file.size > 20 * 1024 * 1024) throw fail(null, "too_large");
      const path = Date.now() + "-" + file.name.replace(/[^\w.-]+/g, "_");
      const { error } = await sb.storage.from("photos").upload(path, file, { contentType: file.type });
      if (error) throw fail(error);
      return { id: sb.storage.from("photos").getPublicUrl(path).data.publicUrl };
    } },
  };
  window.claude = { use: async name => (ready && api[name]) || null };
})();
