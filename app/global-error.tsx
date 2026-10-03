"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="ru">
      <body style={{ background: "#151618", color: "#eeebe5", fontFamily: "system-ui", padding: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 500 }}>Что-то пошло не так</h1>
        <p style={{ opacity: 0.7 }}>Попробуйте обновить страницу.</p>
        <button onClick={reset} style={{ marginTop: 16, padding: "12px 20px", borderRadius: 999, border: 0 }}>
          Обновить
        </button>
      </body>
    </html>
  );
}
