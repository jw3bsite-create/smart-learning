import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // 5180 ist der gewohnte Platz; PORT setzt ihn um, wenn er schon belegt ist.
  server: { port: Number(process.env.PORT) || 5180, open: false },
  build: { target: "es2020" },
});
