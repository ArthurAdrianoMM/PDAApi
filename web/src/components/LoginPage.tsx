import { useState, type FormEvent } from 'react';
import artDark from '../assets/study-breeze-gold-vazado.webp';
import artDarkStill from '../assets/study-breeze-gold-vazado-still.png';
import artLight from '../assets/study-breeze-imperial-blue.webp';
import artLightStill from '../assets/study-breeze-imperial-blue-still.png';
import type { Connection, Theme } from '../state';
import { ArrowRightIcon, EyeIcon, EyeOffIcon, LockIcon, ShieldIcon, SpinnerIcon, UserIcon } from './Icons';

const ART = {
  dark: { animated: artDark, still: artDarkStill },
  light: { animated: artLight, still: artLightStill },
};

interface LoginPageProps {
  title: string;
  version: string;
  theme: Theme;
  connection: Connection;
  /** Where to go after logging in, or when continuing without an account. */
  voltar: string;
}

export function LoginPage({ title, version, theme, connection, voltar }: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const art = ART[theme];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSending(true);
    setError(null);
    const problem = await connection.login(String(form.get('usuario') ?? ''), String(form.get('senha') ?? ''), remember);
    setSending(false);
    if (problem) setError(problem);
    else location.hash = voltar;
  }

  return (
    <div className="login">
      <aside className="login__side">
        <a className="brand" href={voltar}>
          <span className="brand__mark" aria-hidden="true">
            pa
          </span>
          <span className="brand__name">{title}</span>
          <span className="brand__version">v{version}</span>
        </a>
      </aside>

      <picture className="login__art">
        <source media="(prefers-reduced-motion: reduce)" srcSet={art.still} />
        <img src={art.animated} alt="" width={720} height={720} />
      </picture>

      <main className="login__main">
        <a className="login__skip" href={voltar}>
          Seguir sem conta
          <ArrowRightIcon />
        </a>

        <div className="login__panel">
          <header className="login__head">
            <h1>Entrar</h1>
            <p>Use o mesmo usuário e senha do Portal do Aluno para testar os endpoints com seus dados.</p>
          </header>

          {connection.state === 'somente_leitura' ? (
            <div className="notice notice--dashed">
              <strong>Esta cópia não fala com um servidor local</strong>
              <p>
                Rode <code>portal-aluno serve</code> no seu computador e abra a documentação que ele serve para entrar.
              </p>
            </div>
          ) : (
            <form className="login__form" onSubmit={submit} noValidate>
              <div className="login__field">
                <label htmlFor="usuario">Usuário (RA)</label>
                <div className="login__input">
                  <UserIcon size={18} />
                  <input
                    id="usuario"
                    name="usuario"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Seu RA"
                    aria-invalid={error !== null}
                    autoFocus
                  />
                </div>
              </div>

              <div className="login__field">
                <label htmlFor="senha">Senha</label>
                <div className="login__input">
                  <LockIcon size={18} />
                  <input
                    id="senha"
                    name="senha"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Sua senha do portal"
                    aria-invalid={error !== null}
                  />
                  <button
                    type="button"
                    className="login__reveal"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                </div>
              </div>

              <label className="login__remember">
                <input type="checkbox" name="lembrar" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span>
                  <strong>Lembrar de mim</strong>
                  <span>
                    {remember
                      ? 'Fica salvo neste navegador até o servidor reiniciar.'
                      : 'Sem marcar, o acesso vale só nesta aba.'}
                  </span>
                </span>
              </label>

              {error && (
                <p className="notice notice--error" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" className="btn btn--primary login__submit" disabled={sending}>
                {sending ? (
                  <>
                    <SpinnerIcon size={18} />
                    Entrando no portal…
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRightIcon size={18} />
                  </>
                )}
              </button>
            </form>
          )}

          <p className="login__note">
            <ShieldIcon size={18} />
            <span>A senha vai deste computador direto para o portal e fica só na memória do servidor local. Nada é gravado em disco.</span>
          </p>
        </div>
      </main>
    </div>
  );
}
