(() => {
  const cfg = window.APP_CONFIG || {};
  const key = cfg.SUPABASE_PUBLISHABLE_KEY || cfg.SUPABASE_ANON_KEY || '';
  const configured = Boolean(
    cfg.SUPABASE_URL &&
    !cfg.SUPABASE_URL.includes('TU-PROYECTO') &&
    key &&
    !key.includes('TU_CLAVE')
  );

  window.APP_CONFIGURED = configured;
  window.db = configured
    ? window.supabase.createClient(cfg.SUPABASE_URL, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      })
    : null;
})();
