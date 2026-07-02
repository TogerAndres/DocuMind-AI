import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrainCircuit, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";

export function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login, register } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, name, password);
      navigate("/");
    } catch (err) {
      push(err instanceof Error ? err.message : "Algo salió mal", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <BrainCircuit size={26} className="text-accent-teal" />
          <span className="font-display font-semibold text-xl">DocuMind</span>
        </div>

        <div className="card p-6">
          <h1 className="font-display font-semibold text-lg mb-1">
            {mode === "login" ? "Bienvenido de nuevo" : "Crea tu cuenta"}
          </h1>
          <p className="text-sm text-ink-500 mb-5">
            {mode === "login"
              ? "Ingresa a tu base de conocimiento."
              : "Empieza a hacerle preguntas a tus documentos."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "register" && (
              <div>
                <label className="label block mb-1.5">Nombre</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Roger Andrés"
                />
              </div>
            )}
            <div>
              <label className="label block mb-1.5">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@email.com"
              />
            </div>
            <div>
              <label className="label block mb-1.5">Contraseña</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full mt-2">
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {mode === "login" ? "Entrar" : "Crear cuenta"}
            </button>
          </form>

          <button
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="btn-ghost w-full mt-3 justify-center text-xs"
          >
            {mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
          </button>
        </div>
      </div>
    </div>
  );
}
