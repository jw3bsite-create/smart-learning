import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // 5180 ist der gewohnte Platz; PORT setzt ihn um, wenn er schon belegt ist.
  // strictPort: Weicht der Server bei belegtem Port still auf einen anderen
  // aus, wartet der Starter auf 5180 und findet dort nie etwas.
  server: { port: Number(process.env.PORT) || 5180, strictPort: true, open: false },
  build: { target: "es2020" },
});
