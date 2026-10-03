function required(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(
      `[BOOKROOM] Missing environment variable ${name}. Copy .env.example to .env.local and fill in your Supabase keys.`,
    );
  }
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
};
